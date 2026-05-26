# CLAUDE.md — NeoAigent Multi-Tenant SaaS Platform

> This file provides full context for AI assistants working on this codebase.

---

## ¿Qué es esta aplicación?

**NeoAigent** es una plataforma SaaS multi-tenant que permite a negocios (clínicas, restaurantes, tiendas, etc.) tener su propia tienda en línea, CRM e integraciones de IA — todo en un mismo sistema compartido pero completamente aislado.

Cada negocio (llamado **tenant**) opera en su propio subdominio:
- `doctor.newaigent.com` → Clínica Doctor
- `nutrifit.newaigent.com` → Tienda de Nutrición
- `newaigent.com` → Solo página de marketing (NO tiene acceso a ninguna ruta de tenant)

**Stack:** Next.js 14 · TypeScript · Tailwind CSS · Prisma ORM · PostgreSQL (Supabase) · NextAuth v4 · Anthropic Claude AI · Cloudinary · Conekta · PayPal · Stripe · n8n

---

## Arquitectura Multi-Tenant

### Detección de Tenant (middleware.ts)

El middleware detecta el tenant a partir del hostname en cada request:

```
localhost:3000         → Root domain (marketing page only)
newaigent.com          → Root domain (marketing page only)
www.newaigent.com      → Root domain (marketing page only)
doctor.newaigent.com   → tenant slug = "doctor"
clinic.newaigent.com   → tenant slug = "clinic"
myclinic.com           → custom domain → tenant slug = "myclinic.com"
doctor.localhost:3000  → tenant slug = "doctor" (desarrollo local)
```

El slug del tenant se pasa a los server components via el header `x-tenant-slug`.

### Reglas de seguridad del dominio raíz

El dominio raíz (`newaigent.com`, `www.newaigent.com`, `localhost:3000`) es **SOLO** para la página de marketing. Ninguna ruta de tenant está disponible ahí.

Las siguientes rutas están **bloqueadas en el dominio raíz** y devuelven 404:

```
/admin, /login, /registro, /checkout, /carrito, /pedido, /mis-pedidos, /productos, /producto
```

Subdominios válidos (`doctor.newaigent.com`) tienen acceso completo a todas las rutas.

### Aislamiento de datos

- **Todas** las tablas de la base de datos tienen `tenantId`
- Todas las queries en `lib/` y API routes filtran siempre por `tenantId`
- El `tenantId` se extrae del token de sesión NextAuth — nunca del input del usuario
- El header `x-session-user` es limpiado y reescrito por el middleware (prevenir spoofing)

---

## Estructura de Directorios

```
src/
  app/
    (public)/           ← Storefront público del tenant
      page.tsx          ← Homepage (carrusel + productos + reviews + FAQ)
      productos/        ← Catálogo con filtros
      producto/[slug]/  ← Detalle de producto + reseñas
      carrito/          ← Carrito de compras (Zustand)
      checkout/         ← Pasarela de pago (Conekta + PayPal)
      mis-pedidos/      ← Historial de órdenes del cliente
      pedido/[id]/      ← Detalle de un pedido
    (auth)/
      login/            ← Login con email/contraseña + Google OAuth
      registro/         ← Registro de nuevos clientes
    admin/              ← CRM — Solo accesible para role = ADMIN
      dashboard/        ← Métricas: ventas, pedidos, clientes
      productos/        ← CRUD de productos + Cloudinary upload
      pedidos/          ← Gestión de pedidos
      carrusel/         ← Gestión del banner/carrusel de imágenes
      apariencia/       ← Editor de tema (colores + fuente)
      calendario/       ← Integración Google Calendar
      reviews/          ← Moderación de reseñas de clientes
      asistente/        ← Chatbot IA con Claude (tool use)
      faq/              ← CRUD de preguntas frecuentes
      social-campaign/  ← Campañas automatizadas para FB/Instagram
      whatsapp/         ← CRM de conversaciones WhatsApp
      apps/             ← Gestión de integraciones (Google, Facebook, WhatsApp)
    api/
      auth/             ← NextAuth handlers ([...nextauth])
      products/         ← CRUD API de productos
      orders/           ← Creación y consulta de pedidos
      checkout/         ← Procesamiento de pagos (Conekta, PayPal)
      chat/             ← Chatbot IA endpoint (streaming con Claude)
      campaigns/        ← API de campañas sociales
      carousel/         ← API de imágenes del carrusel
      faqs/             ← API de FAQs
      reviews/          ← API de reseñas
      theme/            ← API del tema visual
      apps/             ← Conexión de apps externas (OAuth flows)
      calendar/         ← Google Calendar API proxy
      billing/          ← Stripe webhooks y gestión de suscripciones
      internal/         ← APIs internas para n8n (automatización)
      tenants/          ← API de gestión de tenants
      upload/           ← Upload de imágenes a Cloudinary
      webhooks/         ← Webhooks de Conekta, WhatsApp Evolution API
  components/
    shop/               ← Componentes del storefront público
    admin/              ← Componentes del CRM
    marketing/          ← Componentes de la landing page de NeoAigent
    ui/                 ← Componentes UI reutilizables
  lib/
    ai/                 ← Tools de Claude, system prompt dinámico
    validations/        ← Schemas Zod
    prisma.ts           ← Cliente Prisma singleton
  store/                ← Zustand stores (carrito de compras)
  types/                ← TypeScript type augmentations (NextAuth JWT)
prisma/
  schema.prisma         ← Modelos de datos completos
middleware.ts           ← Gatekeeper multi-tenant + protección de rutas
```

---

## Modelos de Datos Principales

### Tenant
El corazón del sistema. Cada negocio es un Tenant con:
- `slug` (único) → usado para subdominio
- `customDomain` → dominio propio opcional
- `logoUrl`, `whatsappNumber`, `businessInfo`
- `theme` (ThemeConfig 1:1) → colores y fuente del tenant
- `isAssistantEnabled` → toggle del chatbot IA

### User
- Pertenece a un único tenant
- `role`: `CUSTOMER` | `ADMIN`
- Auth: email+password o Google OAuth
- `conektaCustomerId` para pagos recurrentes

### Product
- Tenant-scoped
- `isActive` → visible en storefront
- `deletedAt` → soft delete
- `images[]` → URLs de Cloudinary

### Order + OrderItem
- Estados: `PENDING → PAID → SHIPPED → DELIVERED | CANCELLED`
- Métodos de pago: `CARD_CONEKTA`, `OXXO_CONEKTA`, `PAYPAL`
- `shippingAddress` como JSON

### ConnectedApp
- Integraciones por tenant: Google, Facebook, WhatsApp
- WhatsApp usa Evolution API (campos `wa*`)
- Facebook/Instagram para campañas sociales

### SocialCampaign + SocialPost
- Campañas automatizadas via n8n
- Frecuencias: DAILY, EVERY_3_DAYS, WEEKLY, BIWEEKLY, MONTHLY
- n8n genera contenido con IA y publica en Facebook/Instagram
- `nextPostAt` calculado automáticamente

### Subscription (Stripe)
- Planes: STARTER, PRO, ENTERPRISE
- Estados: TRIALING, ACTIVE, PAST_DUE, CANCELED, UNPAID
- Billing gestionado por Stripe

---

## Autenticación y Autorización

### NextAuth v4
- Providers: `Credentials` (email+password) y `Google`
- El JWT incluye campos custom: `id`, `role`, `tenantId`
- El middleware valida el token en el Edge Runtime con `getToken()`

### Flujos de redirección del middleware:
| Condición | Acción |
|---|---|
| Root domain + ruta de tenant | Rewrite a `/_not-found` (404) |
| `/admin/*` + no logueado | Redirect a `/login` |
| `/admin/*` + logueado pero no ADMIN | Redirect a `/` |
| `/checkout` o `/pedido/*` + no logueado | Redirect a `/login?callbackUrl=...` |
| `/login` o `/registro` + ya logueado | Redirect a `/admin/dashboard` o `/` |

---

## Chatbot IA (Claude)

Endpoint: `POST /api/chat`

Flujo:
1. El admin escribe en lenguaje natural en `/admin/asistente`
2. El frontend envía la conversación a `/api/chat`
3. La API llama a Claude con tools definidas en `src/lib/ai/tools.ts`
4. Claude decide qué tools invocar
5. `execute-tool.ts` ejecuta queries Prisma **siempre filtradas por tenantId**
6. Claude interpreta los datos y responde

Tools disponibles: ventas, pedidos, productos, clientes, reviews, calendario.

---

## Automatización con n8n

Las campañas sociales se automatizan con n8n:

1. n8n hace poll a `GET /api/internal/campaigns/due` (campañas con `nextPostAt` vencido)
2. Genera imágenes y texto con IA
3. Publica en Facebook e Instagram via Graph API
4. Llama a `PATCH /api/internal/campaigns/[id]/posted` para actualizar `lastPostedAt` y calcular `nextPostAt`
5. Guarda el historial en `SocialPost`

Las rutas `/api/internal/*` están excluidas del matcher del middleware.

---

## Variables de Entorno Críticas

```bash
# Base de datos
DATABASE_URL=                    # PostgreSQL en Supabase

# Auth
NEXTAUTH_SECRET=                 # openssl rand -base64 32
NEXTAUTH_URL=                    # http://localhost:3000 (dev) | https://newaigent.com (prod)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# IA
ANTHROPIC_API_KEY=               # Claude API

# Dominio raíz (multi-tenant)
NEXT_PUBLIC_ROOT_DOMAIN=         # newaigent.com

# Pagos
CONEKTA_PRIVATE_KEY=
CONEKTA_WEBHOOK_SECRET=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
STRIPE_SECRET_KEY=               # Platform billing
STRIPE_WEBHOOK_SECRET=

# Cloudinary (imágenes)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# WhatsApp Evolution API
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
```

---

## Comandos Útiles

```bash
npm run dev              # Servidor de desarrollo en localhost:3000
npm run build            # Build de producción
npm run db:generate      # Regenerar Prisma client
npm run db:push          # Aplicar schema a la DB sin migración
npm run db:seed          # Crear datos de ejemplo
npm run db:studio        # Abrir Prisma Studio (UI de BD)
vercel --prod            # Deploy a producción
```

---

## Desarrollo Local con Múltiples Tenants

Para probar subdominos localmente, editar el archivo `hosts` del sistema:

```
127.0.0.1  localhost
127.0.0.1  doctor.localhost
127.0.0.1  nutrifit.localhost
```

Luego acceder a `http://doctor.localhost:3000` para ver el tenant "doctor".

---

## Problemas Conocidos / Pendientes

### Middleware (route blocking)
- El bloqueo de rutas en dominio raíz usa `NextResponse.rewrite(new URL("/_not-found", req.url))`.
- El redirect a `/404` y el uso de `x-forwarded-host` han sido explorados pero presentan problemas en producción con Vercel Edge.
- **Estado actual**: El middleware original (con `req.headers.get("host")`) está restaurado como la versión más estable.

### Pagos
- Conekta tokenización debe hacerse en cliente con `Conekta.js` antes de llamar al backend
- OXXO Pay requiere polling de webhooks de Conekta para confirmar pago

### Pendiente
- Row Level Security en Supabase (actualmente solo filtrado por app)
- Rate limiting en `/api/chat`
- Trial expiry gate completamente implementado en frontend
