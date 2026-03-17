# Plataforma E-commerce + CRM — Clínica de Nutrición

Stack: Next.js 14 · TypeScript · Tailwind CSS · Prisma · PostgreSQL (Supabase) · NextAuth v5 · Claude AI

---

## Estructura del proyecto

```
src/
  app/
    (public)/           ← Sitio público (tienda)
    (auth)/             ← Login / Registro
    admin/              ← CRM (solo admins)
      dashboard/        ← Métricas
      productos/        ← CRUD de productos
      carrusel/         ← Gestión del banner
      apariencia/       ← Colores del tema
      calendario/       ← Google Calendar
      reviews/          ← Gestión de reseñas
      asistente/        ← Chatbot IA con Claude
    api/                ← API Routes
  components/
    shop/               ← Componentes del sitio público
    crm/                ← Componentes del CRM
    chat/               ← Chatbot IA
  lib/
    ai/                 ← Tools de Claude, execute-tool, system-prompt
    validations/        ← Schemas Zod
  store/                ← Zustand (carrito)
  types/                ← TypeScript augmentations
prisma/
  schema.prisma         ← Modelos de datos con multitenant
  seed.ts               ← Datos iniciales
```

---

## Setup

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
# Llenar todas las variables
```

Variables requeridas para el mínimo funcional:
- `DATABASE_URL` — PostgreSQL en Supabase
- `NEXTAUTH_SECRET` — generar con `openssl rand -base64 32`
- `NEXTAUTH_URL` — `http://localhost:3000` en dev
- `ANTHROPIC_API_KEY` — para el chatbot IA

### 3. Base de datos

```bash
npm run db:generate   # genera el Prisma client
npm run db:push       # crea las tablas en Supabase
npm run db:seed       # crea tenant + admin + productos de ejemplo
```

### 4. Correr en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## Rutas principales

| Ruta | Descripción |
|------|-------------|
| `/` | Homepage con carrusel + productos |
| `/productos` | Catálogo completo con filtros |
| `/producto/[slug]` | Detalle + reviews |
| `/carrito` | Carrito de compras |
| `/checkout` | Pago con Conekta o PayPal |
| `/login` | Login con email o Google |
| `/registro` | Registro de clientes |
| `/admin/dashboard` | Métricas del negocio |
| `/admin/productos` | CRUD de productos |
| `/admin/carrusel` | Gestión de imágenes del banner |
| `/admin/apariencia` | Colores del tema |
| `/admin/calendario` | Citas de Google Calendar |
| `/admin/reviews` | Moderar reseñas |
| `/admin/asistente` | Chatbot IA con Claude |

---

## Chatbot IA — cómo funciona

El chatbot en `/admin/asistente` usa la API de Anthropic con **tool use**:

1. La nutrióloga escribe una pregunta en lenguaje natural
2. El frontend envía el mensaje a `POST /api/chat`
3. La API Route llama a Claude con las tools definidas en `src/lib/ai/tools.ts`
4. Claude decide qué tools invocar (ventas, clientes, reviews, calendario)
5. `execute-tool.ts` ejecuta los queries en Prisma **filtrados por `tenantId`**
6. Claude interpreta los datos y responde con análisis + recomendaciones
7. La respuesta aparece en el chat

**Aislamiento multitenant**: El `tenantId` viene de la sesión de NextAuth — nunca del input del usuario.

---

## Pagos

- **Conekta**: tarjetas MX + OXXO Pay → deposita a cuenta bancaria MX
- **PayPal**: botón PayPal → deposita a cuenta PayPal

Son integraciones **independientes**. No hay una pasarela unificada.

En producción, la tokenización de Conekta debe hacerse en el cliente con `Conekta.js` antes de llamar al backend.

---

## Multitenancy

El proyecto está preparado para múltiples clínicas:

- Todas las tablas tienen `tenant_id`
- El tenant se resuelve desde la sesión del usuario (v1)
- En v2: resolución por subdominio via middleware (`nutrifit.tuapp.com`)
- Los colores del tema están en `ThemeConfig` por tenant
- El sistema prompt del chatbot se carga dinámicamente por tenant

---

## TODOs para producción

- [ ] Implementar hashing real con `bcrypt` en register y login
- [ ] Integrar `Conekta.js` en el frontend para tokenizar tarjetas
- [ ] Conectar Google Calendar API con OAuth del admin
- [ ] Agregar streaming en `/api/chat` para mejor UX
- [ ] Activar Row Level Security en Supabase
- [ ] Implementar subdominos para multitenancy
- [ ] Agregar rate limiting en `/api/chat` (máx N consultas/día por tenant)
- [ ] Upload de imágenes con `next-cloudinary` (CldUploadWidget)
