# CLAUDE.md — NewAigent Multi-Tenant SaaS Platform

> This file provides full context for AI assistants working on this codebase.

---

## ¿Qué es esta aplicación?

**NewAigent** es una plataforma SaaS multi-tenant que permite a negocios (clínicas, restaurantes, tiendas, etc.) tener su propia tienda en línea, CRM e integraciones de IA — todo en un mismo sistema compartido pero completamente aislado.

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
      negocio/          ← Perfil del negocio (nombre, logo, WhatsApp, info) — NO incluye slug
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
      credits/          ← API de créditos IA (GET estado, POST recarga Stripe)
      internal/         ← APIs internas para n8n (/tokens/report, /campaigns/due)
      tenants/          ← API de gestión de tenants
      tenants/business/ ← GET/PUT perfil del negocio (name, logoUrl, whatsappNumber, businessInfo). Slug es read-only.
      upload/           ← Upload de imágenes a Cloudinary
      webhooks/         ← Webhooks de Conekta, WhatsApp Evolution API
  components/
    shop/               ← Componentes del storefront público
    admin/              ← Componentes del CRM (CreditsBadge, CreditsDrawer, AdminSidebar)
    chat/               ← Chatbot del CRM (ChatAssistant, AssistantThinkingIndicator)
    marketing/          ← Componentes de la landing page de NewAigent
    ui/                 ← Componentes UI reutilizables

  lib/
    ai/                 ← Tools de Claude / OpenRouter, system prompt dinámico
    credits.ts          ← Motor de contabilidad de tokens, límites y auto-pausa
    credits-error.ts    ← Error CreditExhaustedError
    validations/        ← Schemas Zod
    prisma.ts           ← Cliente Prisma singleton
  store/                ← Zustand stores (carrito de compras)
  types/                ← TypeScript type augmentations (NextAuth JWT)
prisma/
  schema.prisma         ← Modelos de datos completos
local-utils/            ← Scripts de prueba, debugging, utilidades locales que NO forman parte de la app de producción
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
- `aiCreditLimitUsd` → override opcional del tope mensual de créditos IA (null = usa el del plan)

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
- `pausedByCredits` → boolean que indica si la campaña fue auto-pausada por falta de créditos de IA
- **Scheduling gotcha**: Las fechas del formulario se envían como `datetime-local` (`YYYY-MM-DDTHH:mm`) para la `startDate` (con hora exacta del primer post) y `YYYY-MM-DDT23:59:59` para `endDate`. NUNCA envíes solo `YYYY-MM-DD` — JavaScript lo parsea como UTC midnight lo que causa que el primer post se dispare en el ciclo incorrecto o que la campaña expire prematuramente en zonas UTC-.

### AiTokenLedger
- Tabla de contabilidad mensual de tokens y doble contabilidad (Retail vs Wholesale) por tenant
- Campos: `tenantId`, `periodStart`, `periodEnd`, `totalCostUsd` (gasto facturado al tenant), `realProviderCostUsd` (costo real con OpenRouter), `netMarginUsd` (margen bruto retenido), `promptTokens`, `completionTokens`, `creditLimitUsd`, `isPaused`, `pausedAt`, `resumedAt`
- Restricción única: `@@unique([tenantId, periodStart])`

### Subscription (Stripe)
- Planes: STARTER, PRO, ENTERPRISE
- Estados: TRIALING, ACTIVE, PAST_DUE, CANCELED, UNPAID
- Billing gestionado por Stripe

---

## Sistema de Créditos de Tokens IA (Platform AI Metering)

Cada tenant cuenta con un presupuesto mensual de gasto en créditos de IA ($15 USD para Starter).

### 1. Límites por Plan
| Plan | Crédito Mensual |
|---|---|
| **STARTER** | **$15.00 USD** (por defecto) |
| **PRO** | **$50.00 USD** |
| **ENTERPRISE** | **$200.00 USD** |

### 2. Stack de Modelos en Cascada (5 Niveles)
Para maximizar la monetización de créditos ($15 por Starter) y garantizar 100% de disponibilidad, las llamadas se ejecutan en cascada via `src/lib/ai/openrouter.ts`:
1. `anthropic/claude-3.5-sonnet` (Pago: $3.00 in / $15.00 out) — Principal para tool use y español natural.
2. `openai/gpt-4o` (Pago: $2.50 in / $10.00 out) — Respaldo de pago si Anthropic tiene saturación.
3. `google/gemini-2.0-flash-exp:free` (Gratuito: $0.00) — Fallback ultra-rápido de 1M de contexto.
4. `meta-llama/llama-3.3-70b-instruct:free` (Gratuito: $0.00) — Fallback de open-weights para tool use.
5. `deepseek/deepseek-chat:free` (Gratuito: $0.00) — Red de seguridad MoE 671B anti-errores 500.

### 3. Modelo de Negocio: Doble Contabilidad y Arbitraje SaaS
El tenant siempre paga por **unidades de servicio de la plataforma** a la tarifa estándar de retail:
- **Gasto Facturado al Tenant (`totalCostUsd`)**:
  Calculado a `$3.00 USD / 1M` prompt y `$15.00 USD / 1M` completion, **sin importar si el backend usó un modelo gratuito o de pago**. Consume su límite mensual de $15 USD y detona recargas de $15 en Stripe.
- **Costo Real del Proveedor (`realProviderCostUsd`)**:
  Lo que NewAigent realmente adeuda a OpenRouter ($0.00 para modelos `:free`, costo real para Claude/GPT-4o).
- **Margen Bruto Retenido (`netMarginUsd`)**:
  `totalCostUsd - realProviderCostUsd`. Si se ejecuta un modelo gratuito, NewAigent obtiene **100% de margen bruto ($15 USD de beneficio neto por cada $15 de consumo/recarga)**.


### 4. Enforcing y Auto-Pausa
- **Chatbot (`POST /api/chat`)**: Valida créditos antes de invocar OpenRouter. Si se agotaron, devuelve `402 Payment Required` con `{ error: "credit_exhausted" }`. El frontend muestra un toast de error, deshabilita el input y muestra un banner de recarga.
- **Campañas Sociales (`GET /api/campaigns/social/due`)**: Cuando los créditos se agotan, `pauseCampaignsForTenant()` marca `isActive = false, pausedByCredits = true`. El endpoint `due` excluye automáticamente estas campañas para que n8n no genere posts sin saldo.
- **Reporte Externo (`POST /api/internal/tokens/report`)**: Permite a n8n o workflows de WhatsApp reportar consumo de tokens con `x-internal-key`.

### 5. Recarga y Reactivación Automática
- El admin hace clic en "Recargar créditos" en el sidebar (`CreditsBadge`) o en el drawer (`CreditsDrawer`).
- Se genera una sesión de Stripe Checkout (`POST /api/credits`).
- El webhook de Stripe (`checkout.session.completed`) procesa la recarga mediante `rechargeCredits(tenantId, amountUsd)`: incrementa `creditLimitUsd` en el ledger activo y reactiva automáticamente todas las campañas (`resumeCampaignsForTenant()`).


---

## Theming Dinámico y Tipografía Personalizada

El sistema respeta los colores y la tipografía configurados por cada negocio en `/admin/apariencia` (`ThemeConfig`):
- **Variables CSS**: Inyectadas en `:root` como `--color-primary`, `--color-secondary`, `--color-accent` y `--font-family-base`.
- **Google Fonts**: Pre-cargadas en `src/app/layout.tsx` (`Inter`, `Montserrat`, `Playfair Display`, `Roboto`, `Space Grotesk`).
- **Tailwind**: Configurado con `colors.primary = "var(--color-primary)"` y `fontFamily.sans = ["var(--font-family-base)", ...]`.
- **Modales y Drawers Portaleados**: Todo componente que use `createPortal(..., document.body)` (como `CreditsDrawer`) debe declarar explícitamente `style={{ fontFamily: "var(--font-family-base), system-ui, sans-serif" }}` para no perder la tipografía personalizada del tenant al escapar del layout.

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

## Copiloto IA de Negocio (Claude / OpenRouter)

Endpoint: `POST /api/chat`

### Experiencia Nativa en CRM (`/admin/asistente`)
1. **Live KPI Snapshot Bar**: En cada carga (SSR), `src/app/admin/asistente/page.tsx` consulta en paralelo vía Prisma:
   - Ventas del Mes (`revenueMonth`) y conteo de pedidos pagados (`ordersCount`).
   - Pedidos Pendientes (`pendingOrdersCount`).
   - Catálogo Activo de productos (`activeProductsCount`).
   - Campañas Sociales Activas (`activeCampaignsCount`).
2. **Disparadores de Pregunta con 1-Click**: Cada tarjeta de KPI incluye un botón interactivo "Preguntar ↗" al hacer hover, enviando de inmediato una consulta analítica y contextualizada al copiloto.
3. **Atajos Ejecutivos de Navegación**: Cabecera con accesos rápidos directos a `/admin/pedidos`, `/admin/calendario`, `/admin/productos` y `/admin/social-campaign`.
4. **Flujo de Ejecución de Herramientas**:
   - El admin escribe en `/admin/asistente` o da click en una métrica.
   - El frontend envía la conversación a `POST /api/chat`.
   - La API invoca a Claude/OpenRouter con tools definidas en `src/lib/ai/tools.ts`.
   - `execute-tool.ts` ejecuta queries Prisma **siempre filtradas por tenantId** del JWT de sesión.
5. **Seguridad y Protección de Instrucciones del Sistema (`system-prompt.ts`)**:
   - Reglas estrictas contra **Prompt Injection** y jailbreaks.
   - Prohibición absoluta de revelar el system prompt, instrucciones internas, credenciales, tokens o arquitectura subyacente ante solicitudes maliciosas o de ingeniería social.

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

# IA (Claude / OpenRouter)
ANTHROPIC_API_KEY=               # Claude API
OPENROUTER_API_KEY=              # OpenRouter API key
OPENROUTER_MODEL=                # anthropic/claude-sonnet-4-5
OPENROUTER_INPUT_PRICE_PER_M=    # 3.00 (USD / 1M prompt tokens)
OPENROUTER_OUTPUT_PRICE_PER_M=   # 15.00 (USD / 1M completion tokens)

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

### Protección de OAuth en Local (`OAuth Localhost Guard`)
- **Problema previo**: Al conectar Google Calendar o Facebook desde `doctor.localhost:3000`, la app redirigía a `https://doctor.newaigent.com/...` en producción porque `.env` contenía `NEXTAUTH_URL="https://newaigent.com"`.
- **Solución implementada**: Los endpoints `/api/apps/oauth/google/start`, `/callback`, `/api/apps/oauth/facebook/start` y `/callback` detectan automáticamente el header `host`. Si contiene `localhost`:
  - Fijan el `redirect_uri` a `http://localhost:3000/api/apps/oauth/<provider>/callback`.
  - En el callback, el redirect final se construye dinámicamente como `http://${slug}.localhost:3000/admin/...`, asegurando que el desarrollo local permanezca siempre en `localhost:3000` sin necesidad de alterar variables de entorno de producción.

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

---

## Perfil de Negocio (`/admin/negocio`)

- Ruta: `src/app/admin/negocio/page.tsx`
- API: `GET/PUT /api/tenants/business`
- Permite al admin editar: nombre del negocio, logo (Cloudinary upload), número de WhatsApp, descripción del negocio (`businessInfo`).
- **El `slug` (subdominio) es read-only y NUNCA debe ser editable** — identificador único del tenant, modificarlo rompería las URLs.
- El formulario muestra los valores actuales como placeholder y etiqueta "Actual" para cada campo.

---

## Reglas de Desarrollo y Utilidades Locales

### Ubicación Obligatoria de Scripts de Prueba (`local-utils/`)
- **REGLA ESTRICTA**: Si vas a crear una utilidad para probar algo, diagnosticar la base de datos, simular llamadas a APIs, o cualquier script que **NO formará parte de la aplicación del negocio (producción)**, **DEBES agregarlo obligatoriamente dentro de la carpeta `local-utils/`**.
- **PROHIBIDO**: No crees scripts temporales en la raíz del proyecto (`./`), ni en directorios temporales no rastreados como `scratch/`, ni dentro de `src/`.
- Todos los scripts ad-hoc (por ejemplo: scripts para verificar usuarios, backfills, testing de ledger, simuladores de webhooks, etc.) deben residir en `local-utils/`.

### Prohibición de Emojis en la UI
- **NUNCA** uses caracteres emoji (`📋`, `✅`, `⚠️`, `⭐`, `🚀`, etc.) como elementos de UI en JSX/TSX.
- Todos los iconos deben venir de `lucide-react`. Especifica siempre el nombre del componente, tamaño (`size`) y `strokeWidth` cuando sea relevante.
  - Correcto: `<AlertTriangle size={16} className="text-amber-500" />`
  - Incorrecto: `⚠️ Advertencia`
- Los botones de solo icono deben incluir `aria-label` para accesibilidad.

### Seguir el Estilo del Tenant (Tema en Base de Datos)
- Toda nueva página o componente del **storefront público** (`(public)/`) y del **CRM** (`admin/`) debe respetar el tema visual del tenant almacenado en la tabla `ThemeConfig` (`primaryColor`, `secondaryColor`, `accentColor`, `fontFamily`).
- El tema se inyecta como variables CSS desde el layout del tenant. Usa siempre `var(--color-primary)` / `bg-primary` / `text-primary` y las utilidades Tailwind configuradas — **nunca** valores de color hardcodeados (`#16a34a`, `green-600`, etc.) en componentes de tenant.
- En componentes de la **página de marketing** (`marketing/`), sí se permiten colores fijos porque no pertenecen a ningún tenant.
- Si un nuevo componente necesita un color de acento diferente al del tenant, debe exponerlo como prop o CSS token — no codificarlo directamente.
