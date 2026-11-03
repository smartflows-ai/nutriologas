# Plan: Ticket #16 — Recordatorios de citas por WhatsApp (parte de #16)

**Rama**: `fix/16-reminders` · **Complejidad**: Media · **Estado**: esperando CONFIRM
**English summary**: Phase A (isolated per-visit processing + failures reported) is coded and tested but not committed. This plan adds an HTTP 502 when every send fails (so n8n shows an error with no n8n edit), an optional schema step to show undelivered reminders in the CRM, real WhatsApp verification, and keeps every n8n write out of this PR. The PR says "Part of #16", not "Closes #16".

## Resumen

El ticket pide probar de punta a punta que las citas sin confirmar reciben su recordatorio, clasificar cada hueco como falla o exclusión de diseño, y corregir solo las fallas. La exploración de solo lectura (`/n8n`) mostró que el workflow de recordatorios **sí está activo y corre cada 15 minutos sin huecos**, pero n8n marca `success` aunque el endpoint devuelva `failed > 0`. Por eso una falla de envío es invisible. Este plan hace visibles las fallas sin tocar n8n y deja la verificación real como condición para cerrar el ticket.

## Lo verificado (evidencia)

| Hecho | Fuente |
|---|---|
| Workflow `NewAigent - Appointment Reminders` activo, 2 nodos: `Every 15 Minutes` → `POST https://www.newaigent.com/api/internal/reminders/run`, sin `onError` ni `errorWorkflow` | `/n8n`, solo lectura |
| Últimas 10 ejecuciones: `success`, `failed = 0`, `sent = 0`; una cita liberada a las 22:30 UTC | `/n8n`, solo lectura |
| El endpoint en producción es la versión vieja (la respuesta no trae `failures`) | claves de la respuesta |
| El workflow `WhatsApp Bot (Chat)` (41 nodos) **no** es la base a editar; sirve de patrón (`Bot Agent` con `continueErrorOutput` + `Alert Owner`) | `/n8n`, solo lectura |
| Base local: un solo tenant, el tenant de pruebas, con WhatsApp y Facebook conectados, **sin Google Calendar** | consulta a la BD |
| Al reagendar solo se reinicia `reminderSentAt` | `src/lib/appointments-service.ts:157` |

## Patrones a imitar

| Categoría | Fuente | Patrón |
|---|---|---|
| Errores como datos | `src/lib/whatsapp.ts:85-94` | Las funciones devuelven `{ success, reason }`; el log lleva prefijo `[modulo]` |
| Alerta con enfriamiento | `src/app/api/internal/bot/alert-failure/route.ts:11,42-50` | `COOLDOWN_MS` + campo de fecha en `Tenant` |
| Lógica pura con E/S inyectada | `src/lib/reminders.ts` (puro) y `src/lib/reminder-run.ts` (deps inyectadas) | Probar sin BD ni WhatsApp |
| Pruebas | `local-utils/calendar-account.test.ts:1-5` | `node:test` + `assert/strict`, se ejecutan con `npx tsx --test` |
| Insignias de estado | `src/app/admin/citas/page.tsx:63-65` | Mapa de estilos por estado (ver riesgo: colores fijos vs. tokens del tenant) |
| Textos | `src/i18n/{es,en,types}.ts` | Cero texto fijo; claves en `t.crm.*` |

## Decisiones que necesito de ti

| # | Decisión | Recomendación |
|---|---|---|
| D1 | Responder **HTTP 502** cuando se intentaron envíos y **todos** fallaron (`sent = 0` y `failed > 0`); en cualquier otro caso 200. Así n8n muestra la ejecución en rojo sin editar el workflow | **Sí** |
| D2 | Fase B: guardar `reminderAttempts`, `reminderLastError`, `reminderLastAttemptAt` y mostrar una insignia "Recordatorio no entregado" en `/admin/citas` (requiere `db:push`) | **Sí, en este conjunto de cambios** (sin PR hasta que tú lo indiques) |
| D3 | Tope de reintentos: **sin tope duro**. Se reintenta cada 15 min hasta la hora de la cita (un envío fallido no cobra créditos). Un tope podría perder el recordatorio en una caída larga de WhatsApp | **Sin tope; solo visibilidad** |
| D4 | Confirmación hecha por el admin queda en **#23** | Dejarlo en #23 |
| D6 | Adoptar `prisma migrate` (línea base, historial `up/down`) es **tarea aparte para el backlog de git** (confirmado por ti; el issue no se crea hasta que lo autorices). **Decidido por ti:** #16 lleva su par `up.sql`/`down.sql` suelto, sin adoptar `prisma migrate` todavía. | **Par suelto para #16 (decidido)** |
| D5 | Los tres archivos de `local-utils/*.test.ts` ya no están ignorados; se versionan | Sí (revisados, sin secretos) |

## Fases

### Fase 0 — Hecho
Rama, prueba roja, implementación verde (6 pruebas), conexión de la ruta. `tsc` limpio, 18 pruebas pasan. **Sin commit.**

### Fase 0b — Verificar Google Calendar ANTES que todo (pedido por ti)
Tú tienes Google Calendar integrado, pero la última consulta a la base mostró solo `WHATSAPP` y `FACEBOOK` en el tenant de pruebas. Hasta aclararlo, no se avanza a la Fase 3 ni a ningún cambio de esquema.
1. Consulta de **solo lectura** a `connected_apps` (proveedor, fecha de conexión, scopes; sin tokens) y a `appointments` con `externalProvider` distinto de nulo (cuántas y de cuándo).
2. Comparar con lo que ves tú en `/admin/apps` de producción.
3. Posibles causas a descartar: el tenant correcto no es el tenant de pruebas; la conexión se hizo en otra base; el registro se borró al reconectar (`@@unique([tenantId, provider])`); el token venció y la app lo desconectó.
3b. **Evidencia que aportaste (filas de `appointments`, sin copiar datos personales aquí):**
   - Una cita del 31-oct (creada 23:50 UTC) **sí** tiene `externalProvider = GOOGLE` y `externalEventId`: ese día Google estaba conectado.
   - La cita de prueba del 1-nov (18:41 UTC) **no** tiene proveedor ni evento: o Google ya estaba desconectado, o la sincronización falló. El diseño usa solo la base si el calendario falla, así que **falla en silencio**.
   - La cita de Google quedó `CANCELLED` por liberación automática, con `reminderSentAt` a las 21:00 UTC y `autoReleasedAt` a las 22:30 UTC. Es la prueba de producción de que aviso y liberación sí funcionan. Pero conserva su `externalEventId`: el evento de Google **no se borró aún**. El reintento de `removeStuckCalendarEvents` solo limpia el vínculo cuando el evento ya no existe; si Google está desconectado, nunca podrá borrarlo y el evento queda en tu calendario.
   - Falta lo que decide el caso: la fila de `connected_apps` de GOOGLE (si existe, cuándo se conectó y con qué permisos). Esa consulta sigue pendiente.
3c. **Resultado de la consulta (2-nov, solo lectura):** `connected_apps` de el tenant de pruebas solo tiene `WHATSAPP` (26-oct) y `FACEBOOK` (28-oct); **no hay fila de GOOGLE**. Solo 1 cita en toda la base usó Google (31-oct) y quedó cancelada con su evento sin borrar. Google estuvo conectado y la fila desapareció.
   - **Causa probable en el código:** `src/lib/connected-apps.ts:68` borra la conexión entera si la renovación del token responde cualquier error (`!res.ok`), incluso uno temporal (429, 5xx). Un fallo pasajero desconecta Google sin avisar.
   - **Otras causas posibles (sin confirmar):** que alguien pulsara "Desconectar" (`disconnectApp` / `DELETE /api/apps/[provider]`), o que la app de Google esté en modo "Testing", donde el token de renovación caduca a los 7 días.
   - **Para confirmar:** buscar en los logs de Vercel `[connected-apps] Failed to refresh GOOGLE token` cerca del 31-oct al 1-nov; revisar en Google Cloud el estado de publicación de la pantalla de consentimiento; y preguntar si alguien desconectó Google a mano.
   - **Esto es un defecto aparte de #16** (calendario, no recordatorios). Se propone como tarea propia; no se corrige aquí sin tu aprobación.
4. **Estado de esta verificación (resuelto):** el fallo de conexión no era la red ni Supabase: `tsx` no carga `.env` y `pg` caía a `localhost`. Se corre con `npx tsx --env-file=.env ...`. Antes: el intento de hoy falló porque esta terminal no resuelve el DNS del pooler de Supabase (`ECONNREFUSED`; `nslookup` sí resuelve). Hay que repetirla con tu permiso o ejecutarla tú con `! npx tsx local-utils/<script>`.

### Fase 1 — Cerrar la Fase A (sin esquema)
1. **Prueba primero (rojo):** respuesta 502 cuando todos los envíos fallan; 200 si hubo al menos uno enviado; 200 en `dryRun`.
2. Implementar la regla en la ruta `reminders/run` (tarea pequeña: decidir el código de estado a partir de `ReminderBatchResult`).
3. Prueba local de la ruta con `dryRun: true` sobre el tenant de pruebas (solo lectura).
4. `tsc`, todas las pruebas, `npm run build` sin errores.
5. **Yo no hago commit.** Los cambios quedan en el árbol de trabajo. Tú pruebas y validas manualmente y tú haces el commit (mensaje sugerido: `fix: report failed reminder sends and keep the run going after one bad visit`).

### Fase 2 — Visibilidad en el CRM (requiere aprobación para `db:push`)
1. **Aprobación humana antes de tocar el esquema.**
2. Esquema: tres campos nuevos en `Appointment`, nulos o con valor por defecto, **solo aditivos**.
3. Prueba primero: al fallar un envío se guarda intento y último error; al enviar bien se limpian; al reagendar se reinician (`appointments-service.ts:157`).
4. Insignia en `/admin/citas` con texto en `es` y `en` (`types.ts` primero), icono de `lucide-react`, sin emojis ni degradados.
5. Revisión visual: valor vacío, texto largo, otra vertical, modo oscuro, colores muy claros o muy oscuros del tenant.

### Fase 3 — Verificación real (con tu autorización explícita para cada escritura)
Se hace en el tenant de pruebas con **tu propio número**, igual que la prueba de reserva anterior. Se revierte al terminar (cita cancelada, ajustes restaurados).

**Cómo se hace la prueba (ajustes pedidos por ti):**
- **WhatsApp en tu Mac:** tú tienes la app abierta en tu Mac y **yo no la abro ni la controlo**. Los mensajes salen por Evolution API (el servidor), no por esa app. Tú lees lo que llega y me lo cuentas; yo no veo tu pantalla.
- **Prueba corta:** crear un **servicio de prueba** con duración corta (por ejemplo 15 min) en el tenant de pruebas, que se desactiva o borra al terminar. Ojo con lo que sí y lo que no acorta: la duración del servicio no cambia cuándo sale el recordatorio; eso depende de la hora de la cita y de los ajustes. El servidor exige un mínimo de 60 min de anticipación para el aviso y 30 min para el plazo (múltiplos de 30), y esas reglas **no se rebajan** para la prueba.
- **Reducida a 3, 5 y 8 min (pedido por ti):** con los ajustes reales es imposible, porque el código exige una ventana de al menos 30 min entre aviso y liberación (`MIN_ANSWER_MINUTES = 30` en `src/lib/reminders.ts`) y la API rechaza menos de 60/30 min. **No se rebaja esa regla en producción.** En su lugar, un script de `local-utils/` llama a `runReminderBatch` con un **reloj simulado** (la función ya recibe `now` como parámetro) sobre una cita real de prueba en el tenant de pruebas, y con los envíos **reales** a tu número:
  - **Minuto 3:** se ejecuta con la hora simulada del aviso. Te llega el recordatorio real.
  - **Minuto 5:** tú respondes SÍ (o no respondes) y se prueba la confirmación; sin respuesta no pasa nada aún.
  - **Minuto 8:** se ejecuta con la hora simulada del plazo. Si no confirmaste, se libera la cita y te llega el texto de cancelación.
  - La regla probada es la misma de producción; solo cambia qué hora cree el script que es. Los 3 pasos son escritura real (cita, mensajes, cancelación) y cada uno lo apruebas tú.
  - Interpreté tus 3, 5 y 8 min como esos tres momentos. Si querías otra cosa, corrígeme en el canvas.
- **Plan de la prueba más corta con relojes reales (alternativa, sin simulación):** ajustes en el mínimo (aviso 60 min, plazo 30 min), cita de prueba unos 65 a 70 min adelante. El aviso sale en la siguiente corrida de 15 min (por la regla de "reservada después de la hora de aviso") y la liberación 30 min antes de la cita. Duración total aproximada: 35 a 50 min, no horas.
- Cada escritura (crear servicio, ajustar configuración, crear cita) la apruebas tú con `AskUserQuestion`, y se revierte al terminar.
1. Cita sin confirmar → llega el recordatorio con las etiquetas reemplazadas y sin llaves.
2. Responder SÍ → llega la confirmación.
3. No responder → al vencer el plazo llega el texto de cancelación y la cita se libera.
4. Español e inglés; un texto vacío usa el predeterminado; una confirmación sin hora límite o sin SÍ se rechaza.
5. Falla de envío visible: probar con WhatsApp desconectado de forma temporal en un entorno de prueba, o con la prueba unitaria si no se puede desconectar sin riesgo.
6. **Con y sin Google Calendar:** depende del resultado de la **Fase 0b**. Si Google de verdad está desconectado, reconectarlo es acción tuya (OAuth). *La prueba anterior creó un evento de Google, así que hay que explicar por qué desapareció.*

### Fase 4 — Revisión
`/ecc:code-review`, `/ecc:security-scan` (endpoint interno, filtro por `tenantId`, la clave `x-internal-key`), build. Corregir CRITICAL y HIGH antes del PR.

### Fase 5 — Borrador del PR (yo no abro el PR)
**Yo no hago commit ni PR.** Solo dejo el texto del PR listo para que tú lo uses después de validar manualmente. Formato del PR #24 (Qué cambia / Antes de desplegar / Limitaciones / Pruebas / Impacto), con lugar para tus capturas. Título sugerido: **"Parte de #16"**, no "Cierra #16".

## Riesgo de perder datos al tocar la base (explicación pedida)
- **Lo que haría la Fase 2:** agregar 3 columnas nuevas y vacías a `appointments`. No borra ni modifica filas. Es un cambio **aditivo**, de riesgo bajo.
- **Lo que sí puede doler:** `npm run db:push` compara **todo** `schema.prisma` contra la base real y aplica **todas** las diferencias, no solo las mías. `CLAUDE.md` ya lista cambios sin aplicar (`WhatsAppChat.botEnabled`, `botPausedReason`, `Tenant.businessHours`). Un `db:push` arrastraría eso también. Si alguna diferencia implica borrar o recortar una columna, Prisma pide `--accept-data-loss`; **nunca se pasa esa bandera sin tu aprobación**.
- **Antes de aplicar nada:** mostrarte el SQL exacto con una comparación de solo lectura (`prisma migrate diff`) para que veas qué se ejecutaría. Si trae algo más que mis 3 columnas, se decide aparte.
- **Respaldo:** hoy **no sé** si tu plan de Supabase tiene copias automáticas (el plan gratuito no las incluye) ni si hay `pg_dump` en tu Mac. Se verifica en solo lectura antes de la Fase 2; sin respaldo comprobado, no hay `db:push`.
- **Base de pruebas separada (tu propuesta):** hoy la base local y la de producción son la misma, lo que hace riesgoso cada ensayo. Quedará como tarea nueva: una segunda base en Supabase, espejo de la real, para pruebas, y más adelante una instancia local al dockerizar. **No creo el issue todavía:** es una acción hacia afuera; te dejo el borrador y lo publicas tú o me lo autorizas (usaría las herramientas `github-chamba`; no existe un comando con ese nombre).

## Archivo de migración con subida y bajada (pedido por ti)
En vez de `db:push` directo, el cambio de esquema viaja en un archivo versionado con su reversa:
- `up.sql`: agrega las 3 columnas (`ADD COLUMN`, nulas o con valor por defecto).
- `down.sql`: las quita (`DROP COLUMN`). Prisma no genera la bajada solo; se escribe a mano y se revisa. Aviso: `down.sql` borra los datos de esas 3 columnas, por eso solo se usa si hay que deshacer.
- Se generan con `prisma migrate diff` (solo lectura) y quedan en `prisma/migrations/`, para que tú los revises antes de ejecutar nada.
- **Punto honesto:** hoy el proyecto usa `db:push` y no tiene historial de migraciones. Empezar a usar `prisma migrate` sobre una base que ya existe exige una "línea base" (marcar el estado actual como ya aplicado), y los cambios pendientes de `CLAUDE.md` (`botEnabled`, `businessHours`) entrarían en esa línea base. Eso es una decisión aparte (D6): ¿adoptamos migraciones en todo el proyecto, o este cambio lleva solo su par `up/down` en SQL sin cambiar el flujo general?
- Recomendación: para #16, par `up/down` en SQL solo para estas 3 columnas; la adopción de `prisma migrate` se abre como tarea propia junto con la base de pruebas.
- Ejecutarlo sigue necesitando tu aprobación y el respaldo comprobado.

**Resultado de la revisión de respaldos (2-nov, solo lectura):**
- Servidor: PostgreSQL 17.6, `archive_mode = on`. Es una señal de archivado de registros en el servidor, pero **no prueba** que tu plan te dé respaldos restaurables: eso solo se ve en el panel (Database → Backups) y el plan en Organization → Billing. Por SQL no se puede saber.
- Tamaño de la base: **15 MB**. Un respaldo propio es instantáneo y barato, así que no dependemos del plan.
- `pg_dump` local es la versión **14.17** y el servidor es **17.6**: `pg_dump` se niega a respaldar un servidor más nuevo. Falta instalar `postgresql@17` (`brew install postgresql@17`, acción tuya) o usar su ruta explícita.
- **Respaldo previo a la Fase 2:** `pg_dump` 17 a un archivo en `~/.supabase-backups/<fecha>/` (carpeta 700, archivo 600, **fuera del repo**: contiene datos personales). Se verifica que abra y se restaura solo con tu aprobación. Sin ese archivo verificado, no hay cambio de esquema.

**Respaldo hecho y comparación de esquema (2-nov):**
- Respaldo completo y de esquema en `~/.supabase-backups/2026-11-02/` (fuera del repo, permisos 600), hecho con `pg_dump` 17.11 y verificado con `pg_restore --list` (24 tablas con datos). Tu plan no incluye respaldos del proveedor, así que este archivo es el único.
- Comparación de solo lectura base real contra `schema.prisma` (`prisma migrate diff`): la **única** diferencia es `DROP TABLE "whatsapp_bot_memory"`. Esa tabla es la memoria del agente de WhatsApp en n8n (no está en Prisma). **Un `db:push` la borraría y el bot perdería su memoria.** Por eso no se usa `db:push` en este proyecto sin antes agregar esa tabla al esquema o excluirla; el cambio de #16 va solo con `up.sql`/`down.sql`.
- Buena noticia: `botEnabled`, `botPausedReason` y `businessHours` ya están aplicados en la base; los avisos "pendientes" de `CLAUDE.md` están desactualizados.

## Pruebas en el navegador con ECC (pedido por ti)
Cuando una verificación necesite la interfaz (por ejemplo el CRM `/admin/whatsapp`, la insignia en `/admin/citas`, o reconectar Google en `/admin/apps`), uso el navegador de ECC (las herramientas `chrome-devtools`) con estas reglas:
1. **Evidencia con capturas de pantalla** de cada paso relevante, guardadas **fuera del repo** (el repo es público y las pantallas muestran nombres, teléfonos y correos; ya pasó en el PR #24). Te digo la ruta; tú decides qué capturas se publican y las recortas.
2. **Me detengo siempre antes de enviar cualquier formulario.** Yo relleno, reviso y capturo; **nunca** pulso enviar, guardar, conectar ni confirmar.
3. **Te explico qué hice y qué prueba cubre esa simulación:** qué campos llené, con qué valores, qué parte del flujo ejercita y qué parte no (el envío real queda sin probar hasta que tú lo hagas).
4. **Tú envías el formulario a mano en ese mismo navegador.** Después te pido confirmar qué viste y, si hace falta, tomo otra captura del resultado.
5. No abro tu app de WhatsApp ni sitios ajenos al flujo; no escribo credenciales; los datos de prueba usan tu número y marcas de prueba claras.
6. Los pasos de navegador no sustituyen las pruebas unitarias: son evidencia visual y de flujo.

## Orden de despliegue (importante)
1. Aplicar `up.sql` (o `db:push`) a la base real **primero** (cambio aditivo, seguro con el código viejo).
2. Después el código. Si el código sube antes que las columnas, las consultas fallan.
3. La puerta humana aplica a ambos pasos. **Aclarado por ti:** el despliegue lo hace el CI/CD al llegar a `main`; en local no pasa nada. Por eso la fusión a `main` cuenta como despliegue y lleva la puerta humana. Se cierra este punto.

**Por qué ese orden (explicación pedida):** el código nuevo le pide a la base las columnas nuevas al leer citas. Si el código ya está en producción y las columnas aún no existen, esa lectura da error y falla **todo lo que lee citas**: recordatorios, agenda web, bot de WhatsApp y el CRM. En cambio, si las columnas llegan primero, el código viejo simplemente las ignora y nada se rompe. Por eso primero la base, luego el código.

## Glosario: de dónde viene cada término (pedido por ti)
| Término | Qué es | Dónde vive | Quién lo cambia |
|---|---|---|---|
| `remindersEnabled` | Interruptor del negocio: si está apagado, no se envía ningún recordatorio | Campo de `Tenant` (base de datos); lo filtra la consulta de `reminders/run` (`tenant: { remindersEnabled: true }`) | El dueño, en `/admin/whatsapp` > Configuración > "Recordatorios y confirmación" |
| `confirmationRequired` | Si el negocio exige que el cliente confirme; si no responde, la cita se libera | Campo de `Tenant`; lo usa `planReminder` en `src/lib/reminders.ts` | El dueño, en la misma tarjeta |
| `reminderLeadMinutes` | Cuántos minutos antes de la cita sale el aviso (60 a 4320) | `Tenant` | El dueño |
| `confirmationDeadlineMinutes` | Cuántos minutos antes de la cita se libera si no confirmó (30 a 2880) | `Tenant` | El dueño |
| `reminderSentAt` | Cuándo se envió el aviso de esa cita (nulo = aún no) | `Appointment` | Lo escribe `reminders/run`; se reinicia al reagendar |
| `customerConfirmedAt` | Cuándo el cliente confirmó | `Appointment` | `bot/confirm` o el dueño |
| `autoReleasedAt` | Cuándo se liberó por falta de confirmación | `Appointment` | `releaseVisit` |
| `reminderAttempts`, `reminderLastError`, `reminderLastAttemptAt` | **Nuevos (Fase 2):** cuántos intentos fallidos, el motivo del último y cuándo | `Appointment` | `reminders/run` al fallar; se limpian al enviar o reagendar |
| `dryRun` | Modo de ensayo del endpoint: lista qué haría sin enviar, cobrar ni liberar nada | Cuerpo de la petición a `reminders/run` | Quien llama al endpoint |
| `sent` / `failed` / `skipped` / `released` / `checked` | Contadores de la respuesta de cada corrida | Respuesta de `reminders/run` | Se calculan en `src/lib/reminder-run.ts` |
| `x-internal-key` | Contraseña que n8n manda para poder llamar a `/api/internal/*` | Cabecera HTTP; valor en `INTERNAL_API_KEY` | Ops; nunca en el repo |
| `tenantId` | A qué negocio pertenece cada fila; todas las consultas lo filtran | Todas las tablas | Sale de la sesión, nunca de lo que escribe el usuario |

"No se fuerza el recordatorio por encima de `remindersEnabled` ni `confirmationRequired`" significa: aunque la prueba o el reintento quieran enviar, si el dueño apagó los recordatorios o no exige confirmación, se respeta esa decisión y no se envía algo que el negocio no pidió.

## Qué NO se hace
- No se abre ningún PR ni se hace commit hasta que tú lo indiques explícitamente.
- No se edita el workflow `WhatsApp Bot (Chat)`.
- No se escribe nada en n8n dentro de este PR. Cualquier cambio posterior (por ejemplo `errorWorkflow` o una alerta al operador) requiere plan propio, **respaldo completo fuera del repo** y `AskUserQuestion`.
- No se forza el recordatorio por encima de `remindersEnabled` ni `confirmationRequired`.
- No se tocan las citas confirmadas por el admin (#23) ni las plantillas (#15).
- No se rotan los secretos del workflow (se propone como ticket aparte; varios nodos del bot los tienen).
- No se despliega a producción ni se aplica `db:push` sin tu aprobación.

## Riesgos

| Riesgo | Prob. | Mitigación |
|---|---|---|
| El código sube antes que las columnas y las consultas fallan | Media | Orden `db:push` → código; cambio aditivo |
| El 502 hace que n8n reintente o alerte de más | Baja | Solo cuando *todos* los envíos fallan; sin reintento automático en el workflow |
| Alertar por el mismo WhatsApp que está caído (canal circular) | Alta | No se usa `notifyTenantOwner` para esto; la señal es el CRM y el estado de n8n |
| La base local es la real (el tenant de pruebas) | Media | Pruebas con tu número, escrituras acordadas una por una, todo se revierte |
| Insignia con colores fijos contra la regla de tokens del tenant | Media | Usar tokens y clases neutras; no copiar los `amber-500` del mapa existente |
| Falta de un entorno sin WhatsApp o sin Google para los casos "sin" | Alta | Pruebas unitarias para la lógica; reconexión de Google bajo tu control |

## Criterios de aceptación del ticket y cómo se verifican

| Criterio | Cómo se verifica | Estado |
|---|---|---|
| El 100% de las citas elegibles recibe su mensaje; los huecos reales se registran con datos | Consulta de solo lectura que compara citas elegibles contra `reminderSentAt` + prueba real (Fase 3) | Pendiente |
| Probado con y sin Google Calendar | Fase 3, punto 6 | Pendiente (hoy solo "sin") |
| Probado en WhatsApp real | Fase 3, puntos 1 a 4 | Pendiente |
| Una falla de envío ya no es silenciosa | 502 + `failures[]` + insignia en el CRM | Parcial (código listo, sin desplegar) |
| El PR incluye capturas | Fase 5 | Pendiente |
| Prueba de mensajes personalizados | Fase 3, punto 4 (con textos de ejemplo hasta que el cliente entregue los suyos) | Pendiente |

## Validación
```bash
npx tsx --test local-utils/*.test.ts
npx tsc --noEmit
npm run build
```

## Aceptación del plan
- [ ] Fase 0b resuelta: se sabe si Google Calendar está conectado en el tenant de pruebas y por qué
- [ ] D1 a D5 respondidas
- [x] Sin commit ni PR de mi parte: tú validas manualmente y los haces tú
- [ ] Aprobación para `db:push` (Fase 2) o decisión de omitirla
- [ ] Aprobación para la prueba real con tu número (Fase 3)
