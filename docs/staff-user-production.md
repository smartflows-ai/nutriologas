# Rol STAFF en producción (ticket #21)

Guía para activar el rol STAFF ("Asistente") y crear el primer usuario de un negocio en la base real.
Mientras no exista la pantalla de usuarios (#22), el usuario se crea con un script.

## Orden obligatorio: base primero, código después

Vercel solo compila y publica el código; nunca cambia la base de datos (Supabase).
El código de este ticket envía el valor `'STAFF'` a la base. Por ejemplo, la recuperación de contraseña
busca `role IN ('ADMIN', 'STAFF')`. Si el código llega antes que el valor, esa búsqueda falla para todos
los dueños. Al revés no pasa nada: el código viejo ignora el valor nuevo.

1. Aplicar `prisma/sql/19-staff-role/up.sql` (pasos de abajo).
2. Después, hacer el merge del PR. **El merge a `main` es el deploy.**
3. Ya con el código en producción, crear los usuarios STAFF.

## 1. Respaldo verificado

Usa `pg_dump` 17 (`/opt/homebrew/opt/postgresql@17/bin`). Guarda el archivo fuera del repo y con
permisos solo para el dueño, porque contiene datos personales:

```bash
PGBIN=/opt/homebrew/opt/postgresql@17/bin
DIR="$HOME/.supabase-backups/$(date +%F)"; mkdir -p "$DIR" && chmod 700 "$DIR"
( set -a; . ./.env; set +a
  "$PGBIN/pg_dump" "$DIRECT_DATABASE_URL" -Fc -n public --no-owner --no-privileges -f "$DIR/pre-19-$(date +%H%M%S).dump" )
chmod 600 "$DIR"/pre-19-*.dump
"$PGBIN/pg_restore" --list "$DIR"/pre-19-*.dump | grep -c "TABLE DATA"   # debe ser 20 o más
```

## 2. Aplicar `19-staff-role/up.sql` (requiere aprobación explícita)

El cambio es aditivo: agrega un valor al enum `UserRole` y no toca ninguna fila.
Usa `lock_timeout` de 5 s y es idempotente (`IF NOT EXISTS`).

```bash
( set -a; . ./.env; set +a
  "$PGBIN/psql" "$DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f prisma/sql/19-staff-role/up.sql )
```

Verificación (solo lectura):

```bash
( set -a; . ./.env; set +a
  "$PGBIN/psql" "$DIRECT_DATABASE_URL" -Atc "select enum_range(null::\"UserRole\")" )
# esperado: {CUSTOMER,ADMIN,STAFF}
```

Para deshacerlo se usa `down.sql`. Se niega a correr si existe algún usuario STAFF, para no borrar ni
cambiar cuentas en silencio. Solo se usa cuando el código que lee STAFF ya no está en producción.

## 3. Crear un usuario STAFF (después del deploy)

El script no se conecta a ninguna base. Genera un `.sql` que una persona revisa y ejecuta.
La contraseña nunca se imprime ni pasa por la línea de comandos: se genera y se guarda solo en `<salida>.password`,
con permisos `600`.

```bash
mkdir -p ~/.supabase-backups/staff && chmod 700 ~/.supabase-backups/staff
npx tsx local-utils/create-staff-user.ts --tenant-slug <slug> --email <correo> --name "<Nombre>" \
  --out ~/.supabase-backups/staff/<slug>-<nombre>.sql
```

1. Revisa el `.sql`. Ubica el negocio por su slug, se niega si el correo ya existe en ese negocio y solo
   inserta una fila con rol `STAFF`.
2. Pruébalo primero en el mirror local (`/local-db-mirror`):
   `psql "postgresql://tmp@localhost:5544/mirror" -v ON_ERROR_STOP=1 -1 -f <archivo>`.
3. Con aprobación, ejecútalo en producción con el mismo comando contra `DIRECT_DATABASE_URL`, dentro del
   subshell que carga `.env`.
4. Entrega la contraseña por un canal privado. Si la persona la olvida, la recupera en `/recuperar`: el
   código llega al WhatsApp del negocio y el dueño se lo comparte.

## Quitar un usuario de prueba

Primero confirma qué se va a borrar (solo lectura). Luego, con aprobación, borra solo esa fila:

```sql
select u.id, u.email, u.role, t.slug from users u join tenants t on t.id = u."tenantId"
where u.role = 'STAFF' and u.email = '<correo>';

delete from users where role = 'STAFF' and email = '<correo>'
  and "tenantId" = (select id from tenants where slug = '<slug>');
```

Si el `delete` falla por una llave foránea, ese usuario es dueño de alguna cita: pasa cuando alguien agenda
escribiendo el correo de la asistente, un riesgo conocido. Las citas no se borran en cascada. Revisa esas
citas antes de decidir qué hacer; no las borres.

Advertencia: el rol vive 30 días en el token de sesión. Un usuario borrado conserva su acceso hasta que
el token caduque o hasta que cierre sesión. Corregirlo es parte del #22.
