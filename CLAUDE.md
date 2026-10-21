# CLAUDE.md — NewAigent Multi-Tenant SaaS Platform

> This file provides full context for AI assistants working on this codebase.

---

## ¿Qué es esta aplicación?

**NewAigent** es una plataforma SaaS multi-tenant que permite a negocios (clínicas, restaurantes, tiendas, etc.) tener su propia tienda en línea, CRM e integraciones de IA — todo en un mismo sistema compartido pero completamente aislado.

Cada negocio (llamado **tenant**) opera en su propio subdominio:
- `doctor.newaigent.com` → Clínica Doctor
- `nutrifit.newaigent.com` → Tienda de Nutrición
- `newaigent.com` → Solo página de marketing (NO tiene acceso a ninguna ruta de tenant)

**Stack:** Next.js 14 · TypeScript · Tailwind CSS · Prisma ORM · PostgreSQL (Supabase) · NextAuth v4 · Anthropic Claude AI / OpenRouter · Cloudinary · Conekta · PayPal · Stripe · n8n · Upstash Redis

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
      productos/        ← Catálogo con filtros y adaptación para servicios
      producto/[slug]/  ← Detalle de producto o servicio + CTA agendar cita + reseñas
      agendar/[slug]/   ← Flujo interactivo de citas / consultas con selector de 21 días y horarios
      mis-citas/        ← Portal del paciente/cliente para ver y cancelar sus citas
      carrito/          ← Carrito de compras (Zustand)
      checkout/         ← Pasarela de pago (Conekta + PayPal)
      mis-pedidos/      ← Historial de órdenes del cliente
      pedido/[id]/      ← Detalle de un pedido
      terminos/         ← Términos de Servicio — Español
      privacidad/       ← Política de Privacidad — Español
      terms/            ← Terms of Service — English locale alias
      privacy/          ← Privacy Policy — English locale alias
    (auth)/
      login/            ← Login con email/contraseña + Google OAuth
      registro/         ← Registro de nuevos clientes (con consentimiento legal)
    admin/              ← CRM — Solo accesible para role = ADMIN
      dashboard/        ← Métricas: ventas, pedidos, clientes, citas de hoy
      citas/            ← Gestión y agenda de citas médicas/servicios con notas clínicas y estados
      productos/        ← CRUD de productos físicos y servicios/consultas (duración, agendamiento)
      pedidos/          ← Gestión de pedidos
      carrusel/         ← Gestión del banner/carrusel de imágenes
      apariencia/       ← Editor de tema (colores + fuente)
      calendario/       ← Integración Google Calendar y Outlook (Microsoft)
      reviews/          ← Moderación de reseñas de clientes
      asistente/        ← Chatbot IA con Newy AI (tool use, consultas de citas y KPIs)
      faq/              ← CRUD de preguntas frecuentes
      social-campaign/  ← Campañas automatizadas para FB/Instagram (i18n completo)
      whatsapp/         ← CRM de conversaciones WhatsApp
      apps/             ← Gestión de integraciones (Google, Microsoft, Facebook/Instagram Meta, WhatsApp)
      negocio/          ← Perfil del negocio (nombre, logo, WhatsApp, info) — NO incluye slug
      pacientes/        ← Perfiles de pacientes/triage (visible solo si Tenant.isTriageEnabled = true)
      suscripcion/      ← Gestión de suscripción Stripe del tenant
    api/
      appointments/     ← GET/POST citas del tenant (aisladas por tenantId)
      appointments/[id] ← PATCH/DELETE gestión de estado y notas clínicas de citas
      appointments/availability ← GET cálculo de slots disponibles según horario y duración
      auth/             ← NextAuth handlers ([...nextauth])
      products/         ← CRUD API de productos
      orders/           ← Creación y consulta de pedidos
      pedido/[id]/      ← Detalle público de un pedido específico
      checkout/         ← Procesamiento de pagos (Conekta, PayPal)
      chat/             ← Chatbot IA endpoint (streaming con Newy AI)
      campaigns/        ← API de campañas sociales
      carousel/         ← API de imágenes del carrusel
      faqs/             ← API de FAQs
      reviews/          ← API de reseñas
      theme/            ← API del tema visual
      apps/             ← Conexión de apps externas (OAuth flows Google + Facebook)
      calendar/         ← Google Calendar API proxy
      billing/          ← Stripe webhooks y gestión de suscripciones
      credits/          ← API de créditos IA (GET estado, POST recarga Stripe)
      internal/         ← APIs internas para n8n y WhatsApp AI (autenticadas con x-internal-key)
        tokens/report   ← POST: Reportar consumo de tokens desde workflows externos
        render-post-banner ← POST: Componer banner 1080×1080 con Cloudinary SDK para campañas
        triage/         ← GET/POST: Consultar y guardar perfil de paciente desde WhatsApp AI
        tenant-context/ ← POST: Contexto completo del tenant para el agente WhatsApp (products, FAQs, reviews, waConfig)
        calendar/       ← GET availability / POST create-event desde n8n
        whatsapp/sync   ← POST: Sincronizar mensajes de WhatsApp desde Evolution API
        bot/            ← POST: Herramientas del agente WhatsApp (context, availability, book, my-appointments, cancel, reschedule, alert-failure)
        campaigns/alert-failure ← POST: Avisa al dueño por WhatsApp cuando una campaña social falla al publicar
        reminders/run   ← POST: Envía recordatorios de cita vencidos (llamado cada 15 min por n8n, sin LLM)
      admin/pacientes   ← GET: Lista de PatientProfiles para el CRM (filtrada por tenantId)
      tenants/          ← API de gestión de tenants
      tenants/business/ ← GET/PUT perfil del negocio. Slug es read-only.
      upload/           ← Upload de imágenes a Cloudinary
      webhooks/         ← Webhooks de Conekta y WhatsApp Evolution API
      webhooks/social-campaign ← POST: Notificación de n8n al publicar un post (deduce tokens del ledger)
  components/
    shop/               ← Componentes del storefront público
    admin/              ← Componentes del CRM:
      AdminSidebar      ← Navegación lateral con colapso y filtrado dinámico por integración
      CreditsBadge      ← Barra de créditos IA en sidebar
      CreditsDrawer     ← Panel de detalle de créditos (portaleado a document.body)
      TrialBanner       ← Banner de período de prueba activo
      TrialExpiredGate  ← Bloqueo de acceso al CRM cuando el trial expira
      AmazonCheckout    ← UI de checkout alternativa estilo Amazon
      ImageCropperModal ← Modal de recorte de imágenes
      Pagination        ← Componente de paginación reutilizable
    chat/               ← Chatbot del CRM (ChatAssistant, AssistantThinkingIndicator)
    crm/                ← Componentes de visualización del dashboard:
      SalesChart, AppointmentsChart, CampaignMetrics, ProductsChart, RatingsChart
      CalendarView      ← Vista de calendario interactiva
      DashboardFilters  ← Filtros del dashboard
    order/              ← DownloadTicketButton, PrintButton (vista de pedido)
    marketing/          ← Componentes de la landing page de NewAigent
    legal/              ← Componentes legales (LegalPageLayout)
    ui/                 ← Componentes UI reutilizables
  i18n/                 ← Sistema de internacionalización (useTranslation, en.ts, es.ts, types.ts)
  hooks/
    useToast.ts         ← Hook personalizado para toasts
  lib/
    ai/                 ← Tools de Newy AI / OpenRouter, system prompt dinámico
      openrouter.ts     ← Cascade de modelos + computeTokenCost
      tools.ts          ← Definición de tools CRM (ventas, pedidos, productos, etc.)
      execute-tool.ts   ← Ejecutor de tools con Prisma (siempre filtrado por tenantId)
      system-prompt.ts  ← System prompt de Newy AI con defensa anti-jailbreak
    credits.ts          ← Motor de contabilidad de tokens, límites y auto-pausa
    credits-error.ts    ← CreditExhaustedError (error 402)
    trial.ts            ← Helpers de estado de suscripción (getTrialDaysLeft, isTrialExpired, etc.)
    auth.ts             ← Configuración de NextAuth (providers, callbacks, JWT)
    db.ts               ← Cliente Prisma singleton (importar como @/lib/db)
    cloudinary.ts       ← Helper de Cloudinary
    conekta.ts          ← Helper de Conekta
    stripe.ts           ← Helper de Stripe
    connected-apps.ts   ← Helpers para queries de ConnectedApp
    google-calendar.ts  ← Integración completa de Google Calendar
    tenant.ts           ← Helpers de tenant (getBySlug, getByDomain)
    session.ts          ← Helper para extraer sesión en server components
    utils.ts            ← Utilidades generales
    validations/        ← Schemas Zod
    image/              ← Utilidades de procesamiento de imágenes
  store/                ← Zustand stores (carrito de compras)
  types/                ← TypeScript type augmentations (NextAuth JWT)
prisma/
  schema.prisma         ← Modelos de datos completos
local-utils/            ← Scripts de prueba, debugging, utilidades locales que NO forman parte de la app de producción
middleware.ts           ← Gatekeeper multi-tenant + protección de rutas
```

> ⚠️ **Nota crítica para agentes**: El cliente Prisma singleton se importa desde `@/lib/db` (archivo `src/lib/db.ts`), **NO** desde `@/lib/prisma`. Usar la ruta incorrecta causa errores de módulo.

---

## Modelos de Datos Principales

### Tenant
El corazón del sistema. Cada negocio es un Tenant con:
- `slug` (único) → usado para subdominio
- `customDomain` → dominio propio opcional
- `logoUrl`, `whatsappNumber`, `businessInfo`
- `theme` (ThemeConfig 1:1) → colores y fuente del tenant
- `vertical` (`BusinessVertical`) → `ECOMMERCE`, `HEALTH`, `VETERINARY`, `TOURISM`, `SERVICES`
- `isBookingEnabled` → activa el motor de agenda y citas para el tenant
- `isAssistantEnabled` → toggle del chatbot IA por tenant
- `isTriageEnabled` → toggle para habilitar el módulo de triage/pacientes (default: false)
- `aiCreditLimitUsd` → override opcional del tope mensual de créditos IA (null = usa el del plan)
- `botFailureAlertedAt` → última vez que se avisó al dueño que el bot de WhatsApp falló (cooldown de 60 min, ver §"Alertas al Dueño del Tenant")
- `remindersEnabled` → activa los recordatorios de cita por WhatsApp (default: true)
- `reminderOffsetsMinutes` → minutos antes de la cita en que se envía recordatorio (default: `[1440, 120]` = 24 h y 2 h)
- `businessHours` → horario semanal de atención (JSON, por día una lista de bloques `{start, end}`; lista vacía = cerrado; varios bloques por día = hora de comer). Lo edita el admin en `/admin/negocio`. Null en el campo = horario por defecto (lunes a sábado 09:00 a 18:00). Lo leen la web y el bot a través de `src/lib/business-hours.ts`. Pendiente: `npm run db:push`.

### User
- Pertenece a un único tenant
- `role`: `CUSTOMER` | `ADMIN`
- Auth: email+password o Google OAuth
- `conektaCustomerId` para pagos recurrentes
- `appointments` → relación 1:N con citas agendadas

### Product
- Tenant-scoped
- `itemType` (`ItemType`) → `PHYSICAL`, `SERVICE`, `PACKAGE`, `SUBSCRIPTION`
- `durationMinutes` → duración estimada en minutos para citas/consultas (default: 30)
- `requiresBooking` → boolean. Con `Tenant.isBookingEnabled` forma la regla `isBookable` (`src/lib/bookable.ts`): solo los artículos agendables tienen fecha y horario; los demás son solo información (precio y descripción).
- `capacity` → cupo máximo para servicios grupales o tours
- `serviceConfig` → configuración JSON (horarios específicos, requisitos, etc.)
- `isActive` → visible en storefront
- `deletedAt` → soft delete
- `images[]` → URLs de Cloudinary

### Appointment
- Motor nativo de agenda de citas médicas y servicios (aislado por `tenantId`)
- `userId` → paciente o cliente registrado
- `productId` → servicio o consulta médica agendada
- `appointmentDate` → fecha y hora exacta de la cita
- `durationMinutes` → duración de la sesión
- `status` (`AppointmentStatus`) → `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`
- `notes` → motivo de consulta o notas proporcionadas por el paciente
- `internalNotes` → notas clínicas o de atención visibles solo para el profesional (ADMIN)
- `customerPhone` → número de WhatsApp del cliente; identifica al paciente en el bot
- `patientKey` → dígitos del teléfono normalizados a `52` + 10 dígitos (`src/lib/patient-key.ts`). Agrupa las visitas de un paciente en `/admin/historial`. Lo fija `createAppointment` en cada reserva.
- `customerEmail` → email que escribió el cliente al agendar (puede diferir del email de la cuenta vinculada)
- `externalProvider` (`AppProvider`) y `externalEventId` → calendario (`GOOGLE` o `MICROSOFT`) y id del evento que replica la cita; `null` si no hay calendario conectado
- `googleEventId` → legado, reemplazado por `externalEventId`; se elimina tras correr `local-utils/backfill-appointment-calendar-links.mjs`
- `remindersSent` (`Int[]`) → offsets (minutos) ya enviados como recordatorio; reprogramar la cita lo reinicia a `[]`

### Order + OrderItem
- Estados: `PENDING → PAID → SHIPPED → DELIVERED | CANCELLED`
- Métodos de pago: `CARD_CONEKTA`, `OXXO_CONEKTA`, `PAYPAL`
- `shippingAddress` como JSON
- `conektaChargeId` → ID del cargo de Conekta (recibido vía webhook)

### ConnectedApp
- Integraciones por tenant: `GOOGLE`, `MICROSOFT`, `FACEBOOK`, `WHATSAPP`
- WhatsApp usa Evolution API (campos `wa*`):
  - `waInstanceId`, `waInstanceName`, `waStatus`, `waQrCode`, `waPhoneNumber`, `waWebhookUrl`
  - `waTemperature` (Float, default 0.7) → temperatura del modelo IA para respuestas de WhatsApp
  - `waContext` (Text) → contexto personalizado del negocio para el agente de WhatsApp
- Facebook/Instagram para campañas sociales
- `@@unique([tenantId, provider])` → un tenant solo puede tener una app de cada tipo

### PatientProfile
- Perfil de triage de pacientes, vinculado 1:1 con `User`
- Activado por `Tenant.isTriageEnabled = true`
- Campos recopilados por el agente AI de WhatsApp: `age`, `heightCm`, `weightKg`, `goals`, `allergies`, `medicalHistory`, `medications`
- `remoteJid` → identificador de WhatsApp del paciente
- `isTriageComplete` → indica si el cuestionario fue completado
- Visible en `/admin/pacientes` con i18n via `t.crm.triage.*`

### SocialCampaign + SocialPost
- Campañas automatizadas via n8n
- Frecuencias: DAILY, EVERY_3_DAYS, WEEKLY, BIWEEKLY, MONTHLY
- n8n genera contenido con IA y publica en Facebook/Instagram
- `nextPostAt` calculado automáticamente
- `pausedByCredits` → boolean que indica si la campaña fue auto-pausada por falta de créditos de IA
- Campos de configuración: `name`, `campaignGoal` (promocion/informativo/urgencia/testimonio/educativo), `tone` (profesional/cercano/motivacional/urgente), `extraContext`
- Campos de auditoría: `lastResults` (JSON con resultados por plataforma), `lastError`, `lastErrorAt`, `errorNode` (nodo n8n donde ocurrió el error)
- **Scheduling gotcha**: Las fechas del formulario se envían como `datetime-local` (`YYYY-MM-DDTHH:mm`) para la `startDate` (con hora exacta del primer post) y `YYYY-MM-DDT23:59:59` para `endDate`. NUNCA envíes solo `YYYY-MM-DD` — JavaScript lo parsea como UTC midnight lo que causa que el primer post se dispare en el ciclo incorrecto o que la campaña expire prematuramente en zonas UTC-.

### AiTokenLedger
- Tabla de contabilidad mensual de tokens y doble contabilidad (Retail vs Wholesale) por tenant
- Campos: `tenantId`, `periodStart`, `periodEnd`, `totalCostUsd` (gasto facturado al tenant), `realProviderCostUsd` (costo real con OpenRouter), `netMarginUsd` (margen bruto retenido), `promptTokens`, `completionTokens`, `creditLimitUsd`, `isPaused`, `pausedAt`, `resumedAt`
- Restricción única: `@@unique([tenantId, periodStart])`

### Subscription (Stripe)
- Planes: STARTER, PRO, ENTERPRISE
- Estados: TRIALING, ACTIVE, PAST_DUE, CANCELED, UNPAID
- Billing gestionado por Stripe
- `trialEndsAt` → fecha de expiración del período de prueba (14 días desde creación)
- Helpers en `src/lib/trial.ts`: `getTrialDaysLeft()`, `isTenantOnTrial()`, `isTrialExpired()`, `isSubscriptionBlocked()`
- `TrialBanner` → mostrado durante el trial; `TrialExpiredGate` → bloquea el CRM al expirar

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
Para maximizar la monetización de créditos ($15 por Starter) y garantizar 100% de disponibilidad, las llamadas se ejecutan en cascada via `src/lib/ai/openrouter.ts`.
El orden real se configura en la env var `OPENROUTER_MODELS` (lista separada por comas).
Configuracion actual de produccion (modelos gratuitos primero, pagados como último recurso — ver §6 "Balance compartido de OpenRouter"):
1. `nvidia/nemotron-3-super-120b-a12b:free` (Gratuito: $0.00) — Principal.
2. `google/gemma-4-31b-it:free` (Gratuito: $0.00) — Fallback Google open-weights.
3. `openrouter/free` (Gratuito: $0.00) — Selección automática de OpenRouter.
4. `anthropic/claude-sonnet-4.5` (Pago: $3.00 in / $15.00 out) — Respaldo de pago solo si todos los modelos gratuitos fallan o están saturados.
5. `openai/gpt-4o` (Pago: $2.50 in / $10.00 out) — Último respaldo de pago.

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
- **Bot de WhatsApp**: `POST /api/internal/bot/context` incluye `creditExhausted` (de `getCreditStatus()`) en cada mensaje. El nodo "Guard: Credits OK" del workflow lo revisa antes de invocar al agente: si el tenant ya agotó su límite mensual, se omite la llamada al modelo (ningún costo real adicional) y se envía una respuesta fija de degradación en vez de la del LLM — nunca silencio, nunca gasto sin tope.
- **Campañas Sociales (`GET /api/campaigns/social/due`)**: Cuando los créditos se agotan, `pauseCampaignsForTenant()` marca `isActive = false, pausedByCredits = true`. El endpoint `due` excluye automáticamente estas campañas para que n8n no genere posts sin saldo.
- **Deducción de Tokens en Webhook Social (`POST /api/webhooks/social-campaign`)**: Cuando n8n publica un post (`social_campaign_posted`), envía `tokenUsage: { promptTokens, completionTokens, model }`. El webhook invoca atómicamente `recordTokenUsage()` debitando créditos a tarifa retail ($3.00/$15.00 por 1M) sin importar si el modelo fue gratuito, y almacena el registro en `SocialPost.postUrls.aiTokens`.
- **Reporte Externo (`POST /api/internal/tokens/report`)**: Permite a n8n o workflows de WhatsApp reportar consumo de tokens directamente con `x-internal-key`.

### 5. Recarga y Reactivación Automática
- El admin hace clic en "Recargar créditos" en el sidebar (`CreditsBadge`) o en el drawer (`CreditsDrawer`).
- Se genera una sesión de Stripe Checkout (`POST /api/credits`).
- El webhook de Stripe (`checkout.session.completed`) procesa la recarga mediante `rechargeCredits(tenantId, amountUsd)`: incrementa `creditLimitUsd` en el ledger activo y reactiva automáticamente todas las campañas (`resumeCampaignsForTenant()`).

### 6. Alertas al Dueño del Tenant
No existe correo ni Slack en la plataforma; el único canal es el propio WhatsApp del negocio (`Tenant.whatsappNumber`), vía `notifyTenantOwner()` (`src/lib/whatsapp.ts`, reutiliza `sendWhatsAppMessage`). Dos disparadores:
- **Créditos agotados**: dentro de `recordTokenUsage()` (`src/lib/credits.ts`), en la transición `isPaused` false→true (una sola vez por periodo; se compara el estado previo del ledger para no repetir el aviso en cada mensaje posterior).
- **Falla total del bot de WhatsApp**: si el agente de n8n falla con todos los modelos de la cascada (nodo "Bot Agent" con `onError: continueErrorOutput`), el workflow envía al cliente una respuesta fija de disculpa (en vez del silencio total de antes) y llama a `POST /api/internal/bot/alert-failure`, que avisa al dueño con un cooldown de 60 minutos (`Tenant.botFailureAlertedAt`) para no saturarlo durante una caída prolongada.
- **Falla de una campaña social**: el nodo `Notify Error` de `local-utils/n8n-social-campaign-workflow.json` llama a `POST /api/internal/campaigns/alert-failure`, que avisa al dueño (cooldown de 60 minutos, usando `SocialCampaign.lastErrorAt` que ya existía). Antes este nodo posteaba a `$env.WEBHOOK_URL`, que no existe en esta instancia de n8n, así que nunca avisaba a nadie.

### 7. Balance Compartido de OpenRouter
Todos los tenants comparten **una sola cuenta/API key de OpenRouter** — no hay clave por tenant. Agregar crédito real a esa cuenta (p. ej. $10 USD) desbloquea permanentemente el límite diario de modelos gratuitos de la cuenta completa (de 50 a 1000 solicitudes/día) y además queda disponible como saldo gastable cada vez que se usa un modelo de pago (Claude, GPT-4o). Para estirar ese saldo compartido entre todos los tenants:
- La cascada prioriza modelos gratuitos (ver §2); los de pago quedan como último recurso, cuando OpenRouter responde 402/429/5xx en los gratuitos (`src/lib/ai/openrouter.ts` ya reintenta el siguiente modelo automáticamente, sin lógica adicional).
- No existe una verificación previa de saldo real antes de cada llamada (agregaría latencia a cada turno); se confía en la respuesta 402 de OpenRouter para saltar a otro modelo.
- `node local-utils/check_shared_balance.js` suma `realProviderCostUsd` de todos los tenants (periodo actual y total histórico) para vigilar manualmente el saldo compartido. Es una herramienta de operador, nunca se muestra al tenant.
- Una clave de OpenRouter por tenant queda como opción futura, solo si la plataforma crece lo suficiente para que un tenant ruidoso agote el saldo de los demás.


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

## Copiloto IA de Negocio: Newy AI (OpenRouter Cascade)

Endpoint: `POST /api/chat`

### Identidad de Marca y White-Labeling (Regla Absoluta)
El copiloto inteligente de la plataforma tiene como marca exclusiva **Newy AI** (o *Newy AI Copiloto*).
- **Prohibición de Vendor Leaks**: Bajo ninguna circunstancia se debe mostrar a clientes o administradores nombres técnicos de proveedores internos (Claude, Anthropic, OpenAI, GPT, OpenRouter, Evolution API, n8n, etc.).
- **Enmascaramiento de API**: En la respuesta de `POST /api/chat`, el campo `modelUsed` devuelve siempre `"Newy AI"` para proteger la infraestructura interna ante inspecciones de red en el navegador.
- **Defensa de Identidad en `system-prompt.ts`**: Si un usuario pregunta "¿quién eres?" o intenta hacer jailbreak preguntando qué modelo es, Newy AI responde siempre que es el copiloto inteligente desarrollado por NewAigent.

### Experiencia Nativa en CRM (`/admin/asistente`)
1. **Live KPI Snapshot Bar**: En cada carga (SSR), `src/app/admin/asistente/page.tsx` consulta en paralelo vía Prisma:
   - Ventas del Mes (`revenueMonth`) y conteo de pedidos pagados (`ordersCount`).
   - Pedidos Pendientes (`pendingOrdersCount`).
   - Catálogo Activo de productos (`activeProductsCount`).
   - Campañas Sociales Activas (`activeCampaignsCount`).
2. **Disparadores de Pregunta con 1-Click**: Cada tarjeta de KPI incluye un botón interactivo "Preguntar ↗" al hacer hover, enviando de inmediato una consulta analítica y contextualizada a Newy AI.
3. **Atajos Ejecutivos de Navegación**: Cabecera con accesos rápidos directos a `/admin/pedidos`, `/admin/calendario`, `/admin/productos` y `/admin/social-campaign`.
4. **Flujo de Ejecución de Herramientas**:
   - El admin escribe en `/admin/asistente` o da click en una métrica.
   - El frontend envía la conversación a `POST /api/chat`.
   - La API invoca al cascade stack de Newy AI con tools definidas en `src/lib/ai/tools.ts`.
   - `execute-tool.ts` ejecuta queries Prisma **siempre filtradas por tenantId** del JWT de sesión.
5. **Seguridad y Protección de Instrucciones del Sistema (`system-prompt.ts`)**:
   - Reglas estrictas contra **Prompt Injection** y jailbreaks.
   - Prohibición absoluta de revelar el system prompt, instrucciones internas, credenciales, tokens o arquitectura subyacente ante solicitudes maliciosas o de ingeniería social.

Tools disponibles: ventas, pedidos, productos, clientes, reviews, calendario.

---

## Automatización con n8n y Medición de Tokens

Las campañas sociales se ejecutan automáticamente en n8n bajo una estricta **arquitectura API-first** (n8n **nunca** se conecta directamente a la base de datos PostgreSQL; todas las operaciones se realizan mediante llamadas HTTP autenticadas con `x-internal-secret` a las APIs de Next.js):

1. **Consulta de Campañas Programadas**: n8n consulta periódicamente `GET /api/campaigns/social/due` (filtra `nextPostAt <= now AND isActive = true AND pausedByCredits = false`).
2. **Contexto de Campaña y Tenant**: n8n invoca `GET /api/campaigns/social/[id]/context` para recibir la configuración de la campaña, credenciales de Meta y los datos del negocio.
3. **Selección Dinámica de Imagen (`selectedImageUrl`)**:
   - En la UI (`/admin/social-campaign`), el usuario selecciona interactivamente cualquier foto de producto de su catálogo (nunca hardcodeado `images[0]`).
   - La URL seleccionada se persiste en `SocialCampaign.selectedImageUrl` en la base de datos PostgreSQL.
   - En el nodo `Build Image Request`, n8n lee `campaign.selectedImageUrl` directamente desde el payload de contexto. Si no hay una foto asignada, utiliza como respaldo la foto del producto o fotografía editorial libre de marcas de agua.
4. **Almacenamiento Aislado en Cloudinary**:
   - El nodo `Upload to Cloudinary` sube los medios procesados a la ruta por tenant: `nutriologas/{{ tenantId }}/campaigns`.
5. **Generación de Copy Estratégico (Modelos Gratuitos de OpenRouter)**:
   - El nodo `Newy AI - Generate Content` envía el prompt a OpenRouter utilizando `google/gemini-2.0-flash-exp:free` (con respaldo a `meta-llama/llama-3.3-70b-instruct:free` y `openrouter/free`).
   - Incluye filtros de desinfección anti-leak para eliminar tokens de pensamiento (`<think>`) y evitar fugas del system prompt hacia Facebook o Instagram.
6. **Publicación en Meta Graph API**:
   - Facebook Page: `POST /v19.0/{pageId}/photos`.
   - Instagram Business: `POST /v19.0/{igUserId}/media` (contenedor) -> espera 5s -> `POST /v19.0/{igUserId}/media_publish`.
7. **Actualización de Calendario**: Llama a `PATCH /api/campaigns/social/[id]` con `markPosted: true` para que el CRM recalcule el `nextPostAt`.
8. **Auditoría y Ledger de Tokens**:
   - Notifica a `POST /api/webhooks/social-campaign` con `webhookPayload` conteniendo `tokenUsage: { promptTokens, completionTokens, model }`.
   - El webhook deduce créditos en `AiTokenLedger` aplicando las tarifas estándar del SaaS ($3.00 in / $15.00 out por 1M de tokens) y registra el post en `SocialPost`.

---

## Bot de WhatsApp con IA (n8n)

Flujo: `local-utils/n8n-chat-workflow-v2.json` ("NewAigent - WhatsApp Bot (Chat)"). Documentación detallada: `local-utils/N8N_WHATSAPP_BOT_DOCUMENTATION.md`.

- **Entrada**: Evolution API → webhook del workflow (`POST /:tenantSlug`) → guardas (`messages.upsert`, `fromMe = false`, texto y teléfono presentes).
- **Tenant**: se resuelve desde el nombre de instancia de Evolution (`resolveBotTenant` en `src/lib/bot.ts`, busca `waInstanceName` o `waInstanceId`). Nunca se toma del modelo.
- **Identidad del cliente**: su número de WhatsApp. `normalizeCustomerPhone` prefiere `remoteJidAlt`; un `@lid` sin alternativo se rechaza.
- **Agente**: n8n Agent v2.2 con OpenRouter (cascada de modelos gratuitos, credencial de n8n), memoria Postgres `whatsapp_bot_memory` (ventana de 12 mensajes, clave `instancia:teléfono`) y 5 herramientas.
- **Herramientas → endpoints internos** (`x-internal-key`):

  | Herramienta | Endpoint |
  |---|---|
  | `check_availability` | `POST /api/internal/bot/availability` |
  | `book_appointment` | `POST /api/internal/bot/book` |
  | `list_my_appointments` | `POST /api/internal/bot/my-appointments` |
  | `cancel_appointment` | `POST /api/internal/bot/cancel` |
  | `reschedule_appointment` | `POST /api/internal/bot/reschedule` |

  El contexto (servicios, precios, FAQs, `waContext`) llega con `POST /api/internal/bot/context`.
- **Bot por contacto**: `WhatsAppChat.botEnabled` (default `true`) y `botPausedReason` (`manual` o `owner_reply`). El CRM lo cambia con `PATCH /api/apps/whatsapp/chats/[id]` y el dueño escribe con `POST /api/apps/whatsapp/chats/[id]/send` (la escritura pausa el bot). n8n consulta `POST /api/internal/bot/contact-status` antes de ejecutar el agente. Ver `local-utils/N8N_WHATSAPP_BOT_DOCUMENTATION.md`, sección "Bot apagado por contacto".
- **Reglas de negocio**: los precios se pueden citar, nunca cambiar ni descontar. Citas dentro del horario semanal del negocio (`Tenant.businessHours`, `src/lib/business-hours.ts`, hora de Mexico), con duración por servicio. Solo se agendan artículos `isBookable`. El conflicto revisa citas nativas y el calendario conectado (Google u Outlook, `getBusyPeriods` en `src/lib/calendar-sync.ts`); si el calendario falla, solo se usa la base de datos. La web y el bot crean citas con el mismo servicio (`src/lib/appointments-service.ts`).
- **Horas del paciente**: son hora de Mexico. Se construyen con `clinicDateTime()` (`src/lib/clinic-time.ts`, offset `-06:00`) y se leen con `clinicTimeOf()`. Nunca usar sufijo `Z` para una hora elegida por el paciente.
- **Privacidad**: el system prompt prohíbe mencionar formatos técnicos, IDs, herramientas, errores, infraestructura y datos de otros clientes. Es una guía para el modelo, no una garantía. El nodo `Clean Reply` quita saludos repetidos y es el único filtro de salida.
- **Reporte de tokens**: `Collect Token Usage` suma el uso de todas las llamadas del agente y `Report Token Usage` lo envía a `POST /api/internal/tokens/report`, que lo cobra al tenant a tarifa retail. Si el proveedor no reporta uso, se estima (2,000 tokens de prompt por llamada más longitud de respuesta / 4).
- **Créditos agotados**: el nodo "Guard: Credits OK" revisa `creditExhausted` (de `POST /api/internal/bot/context`) antes de llegar al agente. Si el tenant ya agotó su límite mensual, se salta la llamada al modelo y se envía una respuesta fija de degradación.
- **Falla total de la cascada**: el nodo "Bot Agent" tiene `onError: continueErrorOutput`; si fallan todos los modelos, esa rama envía al cliente una respuesta fija de disculpa (en vez de silencio) y llama a `POST /api/internal/bot/alert-failure` para avisar al dueño (cooldown de 60 min, ver §"Alertas al Dueño del Tenant" en la sección de créditos).
- **Reglas de n8n para este flujo**:
  - En nodos Code y herramientas usar `$('Nodo').first().json`, no `$('Nodo').item`. Con `.item` falla con "No data found from `main` input" y la herramienta envía la instancia vacía.
  - `$env` no está disponible en esta instancia de n8n. Los secretos van dentro del workflow.
  - No activar "Require Specific Output Format" ni conectar un Output Parser al agente. El modelo gratuito no sigue ese esquema.

---

## Recordatorios de Citas (workflow separado, sin LLM)

- **Workflow**: `local-utils/n8n-reminders-workflow.json`. Un Schedule Trigger cada 15 minutos llama a `POST /api/internal/reminders/run`.
- **Configuración por tenant**: `remindersEnabled` y `reminderOffsetsMinutes` (default `[1440, 120]`).
- **Regla de envío**: por cada cita con offsets ya alcanzados y no enviados, se manda un solo mensaje (el offset más cercano) y se marcan todos los alcanzados en `remindersSent`. Si el envío falla, no se marca y se reintenta en la siguiente corrida.
- **Canal**: `sendWhatsAppMessage` (Evolution). Con la API oficial de Meta, un recordatorio fuera de la ventana de 24 h necesitará una plantilla aprobada.
- **Pendiente**: aplicar la migración del schema (`npm run db:push`) y construir la pantalla del CRM para configurar los recordatorios.

---

## Estándares de Vocabulario y White-Labeling

Para mantener la calidad y el valor comercial de la plataforma, aplican las siguientes equivalencias obligatorias en interfaces de usuario y mensajes de error:

| Término Interno / Proveedor | Nombre Comercial Visible al Usuario / Cliente |
|---|---|
| Claude / GPT / LLMs | **Newy AI** / Copiloto Newy AI |
| Evolution API | **WhatsApp** / Conexión Segura de WhatsApp |
| n8n | **Automatización Inteligente** / Flujos Automatizados |
| Conekta | **Pasarela de pagos segura** / Tarjeta de crédito o débito |
| OpenRouter / Prompt tokens | **Créditos Newy AI** / Unidades de Inteligencia |

## Variables de Entorno Críticas

```bash
# ─── Base de datos ──────────────────────────────────────────────────────────────
DATABASE_URL=                    # PostgreSQL en Supabase (pooler port 6543 — runtime)
DIRECT_DATABASE_URL=             # Misma URL pero port 5432 — requerido para prisma db push / migrate

# ─── Auth ───────────────────────────────────────────────────────────────────────
NEXTAUTH_SECRET=                 # openssl rand -base64 32
NEXTAUTH_URL=                    # http://localhost:3000 (dev) | https://newaigent.com (prod)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ─── Microsoft OAuth (Outlook Calendar) ─────────────────────────────────────────
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=             # "common" para multi-tenant Microsoft

# ─── IA (Newy AI / OpenRouter) ──────────────────────────────────────────────────
ANTHROPIC_API_KEY=               # Claude API (fallback directo)
OPENROUTER_API_KEY=              # OpenRouter API key (principal)
OPENROUTER_MODEL=                # Modelo primario: anthropic/claude-sonnet-4.5
OPENROUTER_MODELS=               # Cascade completo separado por comas (ver §2 Stack de Modelos)
OPENROUTER_INPUT_PRICE_PER_M=    # 3.00 (USD / 1M prompt tokens — tarifa retail)
OPENROUTER_OUTPUT_PRICE_PER_M=   # 15.00 (USD / 1M completion tokens — tarifa retail)

# ─── Dominio raíz (multi-tenant) ────────────────────────────────────────────────
NEXT_PUBLIC_ROOT_DOMAIN=         # newaigent.com

# ─── Pagos — Conekta ────────────────────────────────────────────────────────────
CONEKTA_PRIVATE_KEY=             # Server-side
NEXT_PUBLIC_CONEKTA_PUBLIC_KEY=  # Client-side (Conekta.js tokenización)
CONEKTA_WEBHOOK_SECRET=
CONEKTA_SUCCESS_URL=             # URL de redirección tras pago exitoso
CONEKTA_FAILURE_URL=             # URL de redirección tras fallo de pago

# ─── Pagos — PayPal ─────────────────────────────────────────────────────────────
PAYPAL_CLIENT_ID=                # Server-side
PAYPAL_CLIENT_SECRET=            # Server-side
NEXT_PUBLIC_PAYPAL_CLIENT_ID=    # Client-side SDK

# ─── Stripe (Platform SaaS Billing) ─────────────────────────────────────────────
STRIPE_SECRET_KEY=               # sk_test_... o sk_live_...
STRIPE_WEBHOOK_SECRET=           # whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # pk_test_... o pk_live_...
STRIPE_PRICE_STARTER_MONTHLY=    # price_...
STRIPE_PRICE_STARTER_ANNUAL=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_ANNUAL=
STRIPE_PRICE_STARTER_MONTHLY_DLLS=  # Variante en USD
STRIPE_PRICE_STARTER_ANNUAL_DLLS=
STRIPE_PRICE_PRO_MONTHLY_DLLS=
STRIPE_PRICE_PRO_ANNUAL_DLLS=

# ─── Cloudinary (imágenes) ──────────────────────────────────────────────────────
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=   # Client-side (uploads directos)
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ─── Facebook / Instagram OAuth (campañas sociales) ─────────────────────────────
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
# FACEBOOK_REDIRECT_URI se auto-detecta desde NEXTAUTH_URL si no se define

# ─── n8n Automatización ─────────────────────────────────────────────────────────
N8N_FACEBOOK_WEBHOOK_URL=        # URL del webhook de n8n para triggerear publicaciones

# ─── APIs Internas (n8n → Next.js) ──────────────────────────────────────────────
# IMPORTANTE: Todos los endpoints en /api/internal/ verifican este header: x-internal-key
INTERNAL_API_KEY=                # openssl rand -hex 32
# Nota: en .env.example puede aparecer como INTERNAL_API_SECRET — deben ser el mismo valor

# ─── WhatsApp Evolution API ──────────────────────────────────────────────────────
EVOLUTION_API_URL=
EVOLUTION_API_KEY=

# ─── Redis / Upstash (cache de sesiones) ────────────────────────────────────────
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

> ⚠️ **Windows `.env` rule**: No uses comillas alrededor de los valores.
> ⚠️ **INTERNAL_API_KEY**: Los endpoints en `/api/internal/` leen `process.env.INTERNAL_API_KEY`. Si tu `.env` lo define como `INTERNAL_API_SECRET`, el header `x-internal-key` fallará con 401/403 silencioso.

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
127.0.0.1  nutriologas.localhost
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
- **Migración del schema sin aplicar**: `WhatsAppChat.botEnabled` y `botPausedReason` requieren `npm run db:push`. Confirmar antes de aplicar.
- **Citas web anteriores al fix de hora**: se guardaron con hora UTC (6 horas adelantadas). Corregir con `local-utils/shift-web-appointments-utc-fix.mjs` (primero sin `--write`) y mover a mano los eventos del calendario que se listen.
- **Secretos hardcodeados en workflows de n8n** (clave interna, API key de Evolution, clave de OpenRouter en la campaña social). Mover a credenciales cuando n8n lo permita, y rotarlos.
- **Workflow social**: si una publicación falla después de generar el texto, sus tokens no se reportan.
- **Pantalla de recordatorios en el CRM**: no construida.
- Row Level Security en Supabase (actualmente solo filtrado por app)
- Rate limiting en `/api/chat`
- Trial expiry gate: `TrialBanner` y `TrialExpiredGate` existen pero el gate de expiración del trial en el layout de admin aún no bloquea completamente todas las rutas

---

## Perfil de Negocio (`/admin/negocio`)

- Ruta: `src/app/admin/negocio/page.tsx`
- API: `GET/PUT /api/tenants/business`
- Permite al admin editar: nombre del negocio, logo (Cloudinary upload), número de WhatsApp, descripción del negocio (`businessInfo`).
- **El `slug` (subdominio) es read-only y NUNCA debe ser editable** — identificador único del tenant, modificarlo rompería las URLs.
- El formulario muestra los valores actuales como placeholder y etiqueta "Actual" para cada campo.
- **El número de WhatsApp es obligatorio** y se guarda como `+<código de país><dígitos>` (8 a 15 dígitos). Lo usan WhatsApp, los recordatorios y el botón de la tienda. El formulario tiene un selector de código de país (predeterminado +52) y la API lo valida con `^\+\d{8,15}$`.
- Helpers de teléfono en `src/lib/phone.ts` (`buildFullPhone`, `splitFullPhone`, `PHONE_COUNTRIES`). Úsalos en cualquier formulario nuevo que pida teléfono; no escribas otro parser.

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

### Estilo Minimalista en Pantallas del Tenant
- Las pantallas del tenant (CRM, storefront, login/registro) siguen un estilo plano y neutral, tipo Claude o ChatGPT. Especificación en `.claude/skills/minimal-ui/references/style-spec.md`.
- Sin gradientes, blur, sombras de color, escala al pasar el cursor ni etiquetas en mayúsculas. Los colores y la fuente del tenant se conservan.
- Para auditar o reescribir estilos usa la skill `minimal-ui` (scripts en `local-utils/minimal-ui/`).
- Las páginas de la marca oscura NewAigent (landing, legales, facturación, 404) no entran en este estilo.

### Seguir el Estilo del Tenant (Tema en Base de Datos)
- Toda nueva página o componente del **storefront público** (`(public)/`) y del **CRM** (`admin/`) debe respetar el tema visual del tenant almacenado en la tabla `ThemeConfig` (`primaryColor`, `secondaryColor`, `accentColor`, `fontFamily`).
- El tema se inyecta como variables CSS desde el layout del tenant. Usa siempre `var(--color-primary)` / `bg-primary` / `text-primary` y las utilidades Tailwind configuradas — **nunca** valores de color hardcodeados (`#16a34a`, `green-600`, etc.) en componentes de tenant.
- En componentes de la **página de marketing** (`marketing/`), sí se permiten colores fijos porque no pertenecen a ningún tenant.
- Si un nuevo componente necesita un color de acento diferente al del tenant, debe exponerlo como prop o CSS token — no codificarlo directamente.

### Reglas Multi-Tenant (Pensar en Todos los Negocios)
- Todo cambio se diseña como regla para **cualquier** tenant, no para el ejemplo que se muestra en una captura. Una captura es un caso, no la especificación.
- No escribir nada con datos de un negocio concreto: etiquetas, colores, verticales, nombres de producto o frases.
- El texto libre de un negocio o del bot (motivo de cita, notas, respuestas) se muestra tal cual, respetando sus saltos de línea. No parsear su formato desde la pantalla: el formato depende de lo que escriba el bot o el cliente. Si el formato importa, se corrige en la fuente (prompt del bot o flujo de reserva).
- Antes de cerrar un cambio de UI, revisar al menos: un valor vacío, uno largo, otra vertical, modo oscuro y colores del tenant muy claros o muy oscuros.
- Al entregar, indicar qué regla se aplicó y qué casos cubre.

---

## Integración Meta (Facebook & Instagram)

- **OAuth Unificado**: Conecta Facebook Pages e Instagram Professional Accounts a través del flujo OAuth de Meta (`/api/apps/oauth/facebook/start` y `/callback`).
- **Scopes Requeridos**: `email`, `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`.
- **Requisito Estricto de Instagram Professional**: Meta Graph API **bloquea cuentas personales** de Instagram para publicación vía API. El usuario debe:
  1. Cambiar la cuenta de Instagram a cuenta Profesional (Negocio o Creador).
  2. Vincular la cuenta de Instagram a su Página de Facebook en Meta Business Suite.
  3. Reconectar Meta desde `/admin/apps` para asociar el `igBusinessAccountId`.
- **Publicación Automática con n8n**: El workflow publica directamente en Facebook (`POST /{pageId}/photos`) e Instagram (`POST /{igUserId}/media` -> `POST /{igUserId}/media_publish`).

---

## Integración Microsoft (Outlook Calendar)

- **OAuth Flow**: `/api/apps/oauth/microsoft/start` y `/callback` — análogo al flujo de Google.
- **Provider Enum**: `MICROSOFT` en `AppProvider` de Prisma.
- **Sidebar**: La ruta `/admin/calendario` requiere `providersReq: ["GOOGLE", "MICROSOFT"]` — se muestra si cualquiera de los dos está conectado.
- **Env vars**: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` (usar `"common"` para multi-tenant).
- **Escritura de eventos**: el scope es `Calendars.ReadWrite` (start, callback y refresh). Las conexiones anteriores son de solo lectura y deben reconectarse; `/admin/apps` muestra un aviso cuando falta el scope. Las llamadas a Graph viven en `src/lib/microsoft-calendar.ts`.

---

## Páginas Legales y Consentimiento de Registro

- **Rutas Legales**: `/terminos` (Términos de Servicio) y `/privacidad` (Política de Privacidad) disponibles en el storefront público y dominio raíz.
- **Componente**: `src/components/legal/LegalPageLayout.tsx` maneja el diseño responsive, branding y soporte multilingüe.
- **Consentimiento Obligatorio**: En `/registro` y en el modal de onboarding (`OnboardingModal.tsx`), el usuario debe marcar la casilla de aceptación de Términos y Política de Privacidad antes de habilitar el botón de creación de cuenta.

---

## Arquitectura de Internacionalización (i18n)

- **Hook Central**: `useTranslation()` desde `@/i18n`.
- **Detección Automática**: Detecta el idioma principal configurado en el navegador del usuario (`navigator.languages[0]` / `navigator.language`) soportando Español (`es`) e Inglés (`en`).
- **Diccionarios Tipados**: `src/i18n/types.ts`, `src/i18n/es.ts`, `src/i18n/en.ts`.
- **Cero Textos Hardcodeados**: Todas las vistas del CRM (incluyendo `/admin/social-campaign`, `/admin/pacientes`, modales, selectores de objetivo/tono/frecuencia, alertas, placeholders y toasts) consumen sus textos desde `t.crm.*`.
- **Rutas legales bilingues**: `/terminos` y `/privacidad` son las rutas en español; `/terms` y `/privacy` son las rutas alias en inglés. Ambas usan el mismo `LegalPageLayout` con i18n.

---

## Módulo de Triage / Pacientes (feature-flagged)

- **Toggle**: `Tenant.isTriageEnabled = true` habilita el módulo (default: `false`).
- **CRM**: `/admin/pacientes` — lista tarjetas de `PatientProfile` con datos recopilados por el agente WhatsApp.
- **API interna**: `GET/POST /api/internal/triage` — autenticada con `x-internal-key`. El agente AI de WhatsApp consulta si un paciente ya tiene triage completo (`isTriageComplete`) y guarda los datos al terminar.
- **Flujo de datos**: WhatsApp AI (n8n) → `POST /api/internal/triage` → crea/actualiza `PatientProfile` → visible en `/admin/pacientes`.
- Si `isTriageEnabled = false`, el endpoint devuelve `{ isTriageComplete: true }` para que n8n omita el flujo de triage sin errores.
- **Nota**: Este módulo **NO fue eliminado**. Está activo y funcional, solo se oculta en la sidebar cuando `isTriageEnabled = false`.

---

## Pipeline de Banners para Campañas Sociales (`/api/internal/render-post-banner`)

- **Endpoint**: `POST /api/internal/render-post-banner`
- **Auth**: Header `x-internal-key` → `process.env.INTERNAL_API_KEY`
- **Función**: Compone una imagen 1080×1080 con Cloudinary SDK:
  1. Sube un overlay SVG con degradado oscuro (scrim), título hero, subtítulo y botón CTA pill
  2. Combina el overlay con la foto base del producto (crop fill + gravity auto)
  3. Devuelve la URL pública de Cloudinary del banner compuesto
- **Llamado por**: n8n antes de publicar en Facebook/Instagram
- **Parámetros body**: `imageUrl` (requerido), `tenantId`, `hero`, `heroHighlight`, `support`, `cta`, `accentColor`
- **Storage**: `nutriologas/{tenantId}/campaigns/banner_{timestamp}`

---

## Verticales de Negocio y Adaptación de Servicios

- **Modelo en DB (`Tenant.vertical`)**: Enum `BusinessVertical` (`ECOMMERCE`, `HEALTH`, `PETS_HOTEL`, `TOURISM`).
- **Adaptación Dinámica**:
  - Para verticales no enfocadas en e-commerce físico (médicos/ginecólogos, veterinarias con hotel de mascotas, agencias de viaje/tours), los productos se configuran como servicios con duración (`durationMinutes`) y agendamiento interactivo (`isBookingEnabled: true`).
  - En la sidebar, la sección de productos cambia automáticamente a "Servicios" para profesionales de salud (`isHealth`).
  - Storefront adapta el botón principal de compra a "Agendar Cita / Servicio" enrutando a `/agendar/[slug]`.
- **Portal de Citas del Paciente**: Los clientes pueden ver sus citas agendadas o cancelarlas en `/mis-citas`.
- **Reserva de Huéspedes e Invitados**: El endpoint `POST /api/appointments` permite reservar citas sin requerir cuenta previa. Guarda el nombre y teléfono del paciente tanto en los campos relacionales (`customerName`, `customerPhone`) como en `notes` como respaldo redundante.

---

## Gestión Unificada de Agenda y Citas (`/admin/citas`)

- **Vista Centralizada Única**: Unifica en una sola pantalla interactiva las citas nativas del CRM (creadas en la web o WhatsApp) y los eventos sincronizados desde **Google Calendar** y **Microsoft Outlook**.
- **Mini-Calendario Interactivo**:
  - Ubicado a la izquierda para navegación rápida por mes y día.
  - Muestra puntos indicadores en los días que tienen citas (de cualquier origen).
  - Al hacer clic en un día, filtra instantáneamente la lista unificada a esa fecha.
- **Sin Cuadrículas Duplicadas**: Se eliminó la vista separada de FullCalendar al pie de la página para evitar discrepancias numéricas y garantizar que todas las citas compartan el mismo listado y métricas KPI (`TOTAL`, `POR CONFIRMAR`, `CONFIRMADAS`, `COMPLETADAS`).
- **Insignias y Acciones por Origen**:
  - Citas de Google Calendar: Muestran la insignia oficial `Google Calendar`, datos del evento y botón directo **"Abrir en Calendar ↗"**.
  - Citas nativas: Muestran precio del servicio, teléfono con enlace directo a WhatsApp (`wa.me`), estado clínico y botones de acción (`Confirmar`, `Atendida`, `No vino`, `Notas clínicas`).
- **Confirmación Automática por WhatsApp**:
  - Al hacer clic en "Confirmar" en una cita, `PATCH /api/appointments/[id]` envía un mensaje automático al paciente vía WhatsApp con el nombre del consultorio, servicio, fecha, hora y duración estimada.
- **Citas replicadas**: una cita creada desde la web o el bot se guarda en la base de datos y crea un evento en el calendario conectado (`externalProvider` / `externalEventId`). Ese evento no aparece por separado; los eventos creados a mano en el calendario sí aparecen.
- **Redirección de Ruta**: `/admin/calendario` redirige directamente a `/admin/citas`.

---

## Conexión de WhatsApp e Integración con Evolution API

- **Banderas Requeridas en la Creación de Instancia**:
  Al crear o conectar una instancia en `POST /api/apps/connect/whatsapp`, se aplican de forma estricta las siguientes banderas tanto en el payload de `/instance/create` como en `/settings/set` y `/webhook/set`:
  1. `events: ["MESSAGES_UPSERT"]` (dispara webhook en mensajes entrantes).
  2. `webhookBase64: true` (envía el payload del webhook en base64).
  3. `rejectCall: true` (rechaza llamadas de voz automáticamente).
  4. `groupsIgnore: true` (ignora mensajes de grupos).
  5. `readMessages: true` (marca mensajes recibidos como leídos).
  6. `alwaysOnline: true` (mantiene la sesión siempre activa en WhatsApp).
  7. `readStatus: false` (desactiva la lectura de estados de WhatsApp).
  8. `syncFullHistory: false`.
- **Detección Confiable de Conexión (`/api/apps/whatsapp/status`)**:
  - Consulta `fetchInstances?instanceName=${instanceName}` en Evolution API.
  - Verifica `connectionStatus === "open"` y extrae el número de teléfono desde `ownerJid` de inmediato.
  - **Sin Interrupción de Handshake**: Se eliminó la llamada recurrente a `/instance/connect` durante el sondeo que reiniciaba el socket mientras el teléfono escaneaba el código QR.
- **Cierre Inmediato del Modal (`WhatsAppModal`)**:
  - Polling a 2 segundos en `/admin/apps`. Al detectar `status === "connected"`, muestra la confirmación visual de éxito y cierra el modal automáticamente en 1.2 segundos.
  - Al abrir el modal, realiza una verificación inmediata para auto-cerrarse si la sesión ya estaba vinculada.

### Estado de la migración a WhatsApp Cloud API (Meta)

- **Hoy**: todo el envío y la recepción pasan por Evolution API. `src/lib/whatsapp.ts` no tiene todavía soporte para la API oficial.
- **Pendiente**: crear la app de Meta y la cuenta de WhatsApp Business, obtener el token de acceso permanente y el ID del número por tenant (se guardaría en `ConnectedApp.waInstanceId`), y aprobar las plantillas de recordatorio. Después, cambiar el envío y el webhook del workflow al formato de Meta.

