# CLAUDE.md — NewAigent Multi-Tenant SaaS Platform

> This file provides full context for AI assistants working on this codebase.

---

## What is this application?

**NewAigent** is a multi-tenant SaaS platform that lets businesses (clinics, restaurants, stores, etc.) have their own online store, CRM and AI integrations — all in one shared system, yet completely isolated.

Each business (called a **tenant**) runs on its own subdomain:
- `doctor.newaigent.com` → Doctor clinic
- `nutrifit.newaigent.com` → Nutrition store
- `newaigent.com` → Marketing page only (NO access to any tenant route)

**Stack:** Next.js 14 · TypeScript · Tailwind CSS · Prisma ORM · PostgreSQL (Supabase) · NextAuth v4 · Anthropic Claude AI / OpenRouter · Cloudinary · Conekta · PayPal · Stripe · n8n · Upstash Redis

---

## Multi-Tenant Architecture

### Tenant detection (middleware.ts)

The middleware detects the tenant from the hostname on every request:

```
localhost:3000         → Root domain (marketing page only)
newaigent.com          → Root domain (marketing page only)
www.newaigent.com      → Root domain (marketing page only)
doctor.newaigent.com   → tenant slug = "doctor"
clinic.newaigent.com   → tenant slug = "clinic"
myclinic.com           → custom domain → tenant slug = "myclinic.com"
doctor.localhost:3000  → tenant slug = "doctor" (local development)
```

The tenant slug is passed to server components through the `x-tenant-slug` header.

### Root domain security rules

The root domain (`newaigent.com`, `www.newaigent.com`, `localhost:3000`) is **ONLY** for the marketing page. No tenant route is available there.

The following routes are **blocked on the root domain** and return 404:

```
/admin, /login, /registro, /checkout, /carrito, /pedido, /mis-pedidos, /productos, /producto
```

Valid subdomains (`doctor.newaigent.com`) have full access to every route.

### Data isolation

- **All** database tables have `tenantId`
- All queries in `lib/` and API routes always filter by `tenantId`
- `tenantId` is taken from the NextAuth session token — never from user input
- The `x-session-user` header is cleared and rewritten by the middleware (to prevent spoofing)

---

## Directory Structure

```
src/
  app/
    (public)/           ← Public tenant storefront
      page.tsx          ← Homepage (carousel + products + reviews + FAQ)
      productos/        ← Catalog with filters and service adaptation
      producto/[slug]/  ← Product or service detail + book-appointment CTA + reviews
      agendar/[slug]/   ← Interactive appointment / consultation flow with a 21-day picker and time slots
      mis-citas/        ← Patient/customer portal to view and cancel their appointments
      carrito/          ← Shopping cart (Zustand)
      checkout/         ← Payment gateway (Conekta + PayPal)
      mis-pedidos/      ← Customer order history
      pedido/[id]/      ← Order detail
      terminos/         ← Terms of Service — Spanish
      privacidad/       ← Privacy Policy — Spanish
      terms/            ← Terms of Service — English locale alias
      privacy/          ← Privacy Policy — English locale alias
    (auth)/
      login/            ← Login with email/password + Google OAuth
      registro/         ← New customer signup (with legal consent)
    admin/              ← CRM — only accessible with role = ADMIN
      dashboard/        ← Metrics: sales, orders, customers, today's appointments
      citas/            ← Management and schedule of medical/service appointments with clinical notes and statuses
      productos/        ← CRUD of physical products and services/consultations (duration, booking)
      pedidos/          ← Order management
      carrusel/         ← Banner/image carousel management
      apariencia/       ← Theme editor (colors + font)
      calendario/       ← Google Calendar and Outlook (Microsoft) integration
      reviews/          ← Customer review moderation
      asistente/        ← AI chatbot with Newy AI (tool use, appointment queries and KPIs)
      faq/              ← FAQ CRUD
      social-campaign/  ← Automated FB/Instagram campaigns (full i18n)
      whatsapp/         ← WhatsApp conversations CRM
      apps/             ← Integration management (Google, Microsoft, Facebook/Instagram Meta, WhatsApp)
      negocio/          ← Business profile (name, logo, WhatsApp, info) — does NOT include the slug
      pacientes/        ← Patient/triage profiles (visible only if Tenant.isTriageEnabled = true)
      suscripcion/      ← Tenant Stripe subscription management
    api/
      appointments/     ← GET/POST tenant appointments (isolated by tenantId)
      appointments/[id] ← PATCH/DELETE appointment status and clinical notes management
      appointments/availability ← GET available-slot calculation based on schedule and duration
      auth/             ← NextAuth handlers ([...nextauth])
      products/         ← Products CRUD API
      orders/           ← Order creation and lookup
      pedido/[id]/      ← Public detail of a specific order
      checkout/         ← Payment processing (Conekta, PayPal)
      chat/             ← AI chatbot endpoint (streaming with Newy AI)
      campaigns/        ← Social campaigns API
      carousel/         ← Carousel images API
      faqs/             ← FAQs API
      reviews/          ← Reviews API
      theme/            ← Visual theme API
      apps/             ← Connection of external apps (Google + Facebook OAuth flows)
      calendar/         ← Google Calendar API proxy
      billing/          ← Stripe webhooks and subscription management
      credits/          ← AI credits API (GET status, POST Stripe recharge)
      internal/         ← Internal APIs for n8n and WhatsApp AI (authenticated with x-internal-key)
        tokens/report   ← POST: Report token consumption from external workflows
        render-post-banner ← POST: Compose a 1080×1080 banner with the Cloudinary SDK for campaigns
        triage/         ← GET/POST: Look up and save a patient profile from WhatsApp AI
        tenant-context/ ← POST: Full tenant context for the WhatsApp agent (products, FAQs, reviews, waConfig)
        calendar/       ← GET availability / POST create-event from n8n
        whatsapp/sync   ← POST: Sync WhatsApp messages from Evolution API
        bot/            ← POST: WhatsApp agent tools (context, availability, book, my-appointments, cancel, reschedule, alert-failure)
        campaigns/alert-failure ← POST: Notifies the owner via WhatsApp when a social campaign fails to publish
        places/search   ← POST (public, rate-limited per IP): Google Places address suggestions
        places/details  ← POST (public, rate-limited per IP): address and coordinates of a place
        reminders/run   ← POST: Sends reminders, charges for each one and releases unconfirmed appointments (every 15 min from n8n, no LLM)
      admin/pacientes   ← GET: List of PatientProfiles for the CRM (filtered by tenantId)
      tenants/          ← Tenant management API
      tenants/business/ ← GET/PUT business profile. Slug is read-only.
      upload/           ← Image upload to Cloudinary
      webhooks/         ← Conekta and WhatsApp Evolution API webhooks
      webhooks/social-campaign ← POST: n8n notification when a post is published (deducts tokens from the ledger)
  components/
    shop/               ← Public storefront components
    admin/              ← CRM components:
      AdminSidebar      ← Side navigation with collapse and dynamic filtering by integration
      CreditsBadge      ← AI credits bar in the sidebar
      CreditsDrawer     ← Credits detail panel (portaled to document.body)
      TrialBanner       ← Active trial period banner
      TrialExpiredGate  ← Blocks CRM access when the trial expires
      AmazonCheckout    ← Alternative Amazon-style checkout UI
      ImageCropperModal ← Image crop modal
      Pagination        ← Reusable pagination component
    chat/               ← CRM chatbot (ChatAssistant, AssistantThinkingIndicator)
    crm/                ← Dashboard visualization components:
      SalesChart, AppointmentsChart, CampaignMetrics, ProductsChart, RatingsChart
      CalendarView      ← Interactive calendar view
      DashboardFilters  ← Dashboard filters
    order/              ← DownloadTicketButton, PrintButton (order view)
    marketing/          ← NewAigent landing page components
    legal/              ← Legal components (LegalPageLayout)
    ui/                 ← Reusable UI components
  i18n/                 ← Internationalization system (useTranslation, en.ts, es.ts, types.ts)
  hooks/
    useToast.ts         ← Custom hook for toasts
  lib/
    ai/                 ← Newy AI / OpenRouter tools, dynamic system prompt
      openrouter.ts     ← Model cascade + computeTokenCost
      tools.ts          ← CRM tool definitions (sales, orders, products, etc.)
      execute-tool.ts   ← Tool executor with Prisma (always filtered by tenantId)
      system-prompt.ts  ← Newy AI system prompt with anti-jailbreak defense
    credits.ts          ← Token accounting engine, limits and auto-pause
    credits-error.ts    ← CreditExhaustedError (402 error)
    trial.ts            ← Subscription state helpers (getTrialDaysLeft, isTrialExpired, etc.)
    auth.ts             ← NextAuth configuration (providers, callbacks, JWT)
    db.ts               ← Prisma client singleton (import as @/lib/db)
    cloudinary.ts       ← Cloudinary helper
    conekta.ts          ← Conekta helper
    stripe.ts           ← Stripe helper
    connected-apps.ts   ← Helpers for ConnectedApp queries
    google-calendar.ts  ← Full Google Calendar integration
    tenant.ts           ← Tenant helpers (getBySlug, getByDomain)
    session.ts          ← Helper to extract the session in server components
    utils.ts            ← General utilities
    validations/        ← Zod schemas
    image/              ← Image processing utilities
  store/                ← Zustand stores (shopping cart)
  types/                ← TypeScript type augmentations (NextAuth JWT)
prisma/
  schema.prisma         ← Full data models
local-utils/            ← Test scripts, debugging and local utilities that are NOT part of the production app
middleware.ts           ← Multi-tenant gatekeeper + route protection
```

> ⚠️ **Critical note for agents**: The Prisma client singleton is imported from `@/lib/db` (file `src/lib/db.ts`), **NOT** from `@/lib/prisma`. Using the wrong path causes module errors.

---

## Core Data Models

### Tenant
The heart of the system. Each business is a Tenant with:
- `slug` (unique) → used for the subdomain
- `customDomain` → optional custom domain
- `logoUrl`, `whatsappNumber`, `businessInfo`
- `theme` (ThemeConfig 1:1) → tenant colors and font
- `vertical` (`BusinessVertical`) → `ECOMMERCE`, `HEALTH`, `VETERINARY`, `TOURISM`, `SERVICES`
- `isBookingEnabled` → enables the scheduling and appointment engine for the tenant
- `isAssistantEnabled` → per-tenant AI chatbot toggle
- `isTriageEnabled` → toggle to enable the triage/patients module (default: false)
- `aiCreditLimitUsd` → optional override of the monthly AI credit cap (null = use the plan's)
- `botFailureAlertedAt` → last time the owner was told the WhatsApp bot failed (60-minute cooldown, see §"Tenant Owner Alerts")
- `remindersEnabled` → enables WhatsApp appointment reminders (default: true)
- `reminderLeadMinutes`, `confirmationRequired`, `confirmationDeadlineMinutes`, `reminderTemplate`, `confirmationTemplate`, `cancellationTemplate`, `messageLanguage` → reminder and confirmation settings (see "Appointment Reminders and Confirmation"). `reminderMode` and `reminderSendTime` are legacy.
- `reminderOffsetsMinutes` → legacy: no longer used (replaced by `reminderLeadMinutes`)
- `businessHours` → weekly opening hours (JSON, a list of `{start, end}` blocks per day; empty list = closed; several blocks per day = lunch break). Edited by the admin in `/admin/negocio`. Null in the field = default hours (Monday to Saturday 09:00 to 18:00). Read by the web and the bot through `src/lib/business-hours.ts`. Pending: `npm run db:push`.
- `ownerName`, `hasPhysicalLocation`, `address`, `placeId`, `latitude`, `longitude` → owner or person in charge and business location (address chosen with Google Maps). The address only exists with `hasPhysicalLocation = true`; turning it off clears it. Captured at signup and in `/admin/negocio`, shown on the store homepage, and the WhatsApp bot receives them in `bot/context` (`ownerName`, `locationText`). Helpers in `src/lib/location.ts` (`locationSchema`, `directionsUrl`, `locationTextForBot`).

### User
- Belongs to a single tenant
- `role`: `CUSTOMER` | `ADMIN`
- Auth: email+password or Google OAuth
- `conektaCustomerId` for recurring payments
- `appointments` → 1:N relation with booked appointments

### Product
- Tenant-scoped
- `itemType` (`ItemType`) → `PHYSICAL`, `SERVICE`, `PACKAGE`, `SUBSCRIPTION`
- `durationMinutes` → estimated duration in minutes for appointments/consultations (default: 30)
- `requiresBooking` → boolean. Together with `Tenant.isBookingEnabled` it forms the `isBookable` rule (`src/lib/bookable.ts`): only bookable items have a date and time; the rest are information only (price and description).
- `capacity` → maximum capacity for group services or tours
- `serviceConfig` → JSON configuration (specific schedules, requirements, etc.)
- `isActive` → visible in the storefront
- `deletedAt` → soft delete. `DELETE /api/products/[id]` really deletes only if no `OrderItem`, `Review` or `Appointment` points to the product; if any exists, it is hidden (soft delete) to preserve appointment and order history.
- `GET /api/products/categories` (admin) → distinct tenant categories for the product form autocomplete (`<datalist>`).
- `images[]` → Cloudinary URLs

### Appointment
- Native scheduling engine for medical and service appointments (isolated by `tenantId`)
- `userId` → registered patient or customer
- `productId` → booked service or medical consultation
- `appointmentDate` → exact date and time of the appointment
- `durationMinutes` → session duration
- `status` (`AppointmentStatus`) → `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`
- `notes` → reason for the visit or notes provided by the patient
- `internalNotes` → clinical or care notes visible only to the professional (ADMIN)
- `customerPhone` → customer's WhatsApp number; identifies the patient in the bot
- `patientKey` → phone digits normalized to `52` + 10 digits (`src/lib/patient-key.ts`). Groups a patient's visits in `/admin/historial`. Set by `createAppointment` on every booking.
- `customerEmail` → email the customer typed when booking (may differ from the linked account's email)
- `externalProvider` (`AppProvider`) and `externalEventId` → calendar (`GOOGLE` or `MICROSOFT`) and id of the event that mirrors the appointment; `null` if no calendar is connected
- `googleEventId` → legacy, replaced by `externalEventId`; removed after running `local-utils/backfill-appointment-calendar-links.mjs`
- `reminderSentAt`, `customerConfirmedAt`, `autoReleasedAt` → reminder sent, confirmed by the customer, and released without confirmation. Rescheduling the appointment resets them. `remindersSent` is legacy.

- `petId` → the owner's pet (only for pet verticals: `VETERINARY`, `PET_CARE`). Null in the rest. See the `Pet` model.

### Pet
- A pet belonging to an owner (`VETERINARY` and `PET_CARE`). Table `pets`.
- `patientKey` → normalized owner phone (same rule as `Appointment.patientKey`). `name` → name as typed. `nameKey` → lowercase name without extra spaces; together with `tenantId` and `patientKey` it is unique, so "Max" and " max " are the same pet of the same owner.
- `species` → `dog`, `cat`, `bird`, `rabbit` or `other` (`src/lib/pets.ts`). `breed` exists, but no screen asks for it yet.
- `findOrCreatePet()` runs inside the same transaction as the appointment, after confirming the slot is free; if the slot was taken, no pet is created.

### Order + OrderItem
- Statuses: `PENDING → PAID → SHIPPED → DELIVERED | CANCELLED`
- Payment methods: `CARD_CONEKTA`, `OXXO_CONEKTA`, `PAYPAL`
- `shippingAddress` as JSON
- `conektaChargeId` → Conekta charge ID (received via webhook)

### ConnectedApp
- Per-tenant integrations: `GOOGLE`, `MICROSOFT`, `FACEBOOK`, `WHATSAPP`
- WhatsApp uses Evolution API (`wa*` fields):
  - `waInstanceId`, `waInstanceName`, `waStatus`, `waQrCode`, `waPhoneNumber`, `waWebhookUrl`
  - `waTemperature` (Float, default 0.7) → AI model temperature for WhatsApp replies
  - `waContext` (Text) → custom business context for the WhatsApp agent
- Facebook/Instagram for social campaigns
- `@@unique([tenantId, provider])` → a tenant can have only one app of each type

### PatientProfile
- Patient triage profile, linked 1:1 to `User`
- Enabled by `Tenant.isTriageEnabled = true`
- Fields collected by the WhatsApp AI agent: `age`, `heightCm`, `weightKg`, `goals`, `allergies`, `medicalHistory`, `medications`
- `remoteJid` → the patient's WhatsApp identifier
- `isTriageComplete` → indicates whether the questionnaire was completed
- Visible in `/admin/pacientes` with i18n via `t.crm.triage.*`

### SocialCampaign + SocialPost
- Automated campaigns via n8n
- Frequencies: DAILY, EVERY_3_DAYS, WEEKLY, BIWEEKLY, MONTHLY
- n8n generates content with AI and publishes to Facebook/Instagram
- `nextPostAt` is calculated automatically
- `pausedByCredits` → boolean indicating the campaign was auto-paused for lack of AI credits
- Configuration fields: `name`, `campaignGoal` (promocion/informativo/urgencia/testimonio/educativo), `tone` (profesional/cercano/motivacional/urgente), `extraContext`
- Audit fields: `lastResults` (JSON with per-platform results), `lastError`, `lastErrorAt`, `errorNode` (n8n node where the error occurred)
- **Scheduling gotcha**: Form dates are sent as `datetime-local` (`YYYY-MM-DDTHH:mm`) for `startDate` (with the exact time of the first post) and `YYYY-MM-DDT23:59:59` for `endDate`. NEVER send only `YYYY-MM-DD` — JavaScript parses it as UTC midnight, which makes the first post fire in the wrong cycle or the campaign expire prematurely in UTC- timezones.

### AiTokenLedger
- Monthly token accounting table with double accounting (Retail vs Wholesale) per tenant
- Fields: `tenantId`, `periodStart`, `periodEnd`, `totalCostUsd` (spend billed to the tenant), `realProviderCostUsd` (real cost with OpenRouter), `netMarginUsd` (gross margin retained), `promptTokens`, `completionTokens`, `reminderCount` (reminders charged), `creditLimitUsd`, `isPaused`, `pausedAt`, `resumedAt`
- Unique constraint: `@@unique([tenantId, periodStart])`

### Subscription (Stripe)
- Plans: STARTER, PRO, ENTERPRISE
- Statuses: TRIALING, ACTIVE, PAST_DUE, CANCELED, UNPAID
- Billing managed by Stripe
- `trialEndsAt` → trial period expiration date (14 days from creation)
- Helpers in `src/lib/trial.ts`: `getTrialDaysLeft()`, `isTenantOnTrial()`, `isTrialExpired()`, `isSubscriptionBlocked()`
- `TrialBanner` → shown during the trial; `TrialExpiredGate` → blocks the CRM on expiry

---

## AI Token Credits System (Platform AI Metering)

Each tenant has a monthly AI credit spending budget ($15 USD for Starter).

### 1. Plan limits
| Plan | Monthly credit |
|---|---|
| **STARTER** | **$15.00 USD** (default) |
| **PRO** | **$50.00 USD** |
| **ENTERPRISE** | **$200.00 USD** |

### 2. Cascading model stack (5 tiers)
To maximize credit monetization ($15 per Starter) and guarantee 100% availability, calls run as a cascade via `src/lib/ai/openrouter.ts`.
The real order is configured in the env var `OPENROUTER_MODELS` (comma-separated list).
Current production configuration (free models first, paid models as a last resort — see §7 "Shared OpenRouter balance"):
1. `nvidia/nemotron-3-super-120b-a12b:free` (Free: $0.00) — Primary.
2. `google/gemma-4-31b-it:free` (Free: $0.00) — Google open-weights fallback.
3. `openrouter/free` (Free: $0.00) — OpenRouter automatic selection.
4. `anthropic/claude-sonnet-4.5` (Paid: $3.00 in / $15.00 out) — Paid backup only if all free models fail or are saturated.
5. `openai/gpt-4o` (Paid: $2.50 in / $10.00 out) — Last paid backup.

### 3. Business model: double accounting and SaaS arbitrage
The tenant always pays for **platform service units** at the standard retail rate:
- **Spend billed to the tenant (`totalCostUsd`)**:
  Calculated at `$3.00 USD / 1M` prompt and `$15.00 USD / 1M` completion, **regardless of whether the backend used a free or paid model**. It consumes the tenant's monthly $15 USD limit and triggers $15 recharges in Stripe.
- **Real provider cost (`realProviderCostUsd`)**:
  What NewAigent actually owes OpenRouter ($0.00 for `:free` models, real cost for Claude/GPT-4o).
- **Gross margin retained (`netMarginUsd`)**:
  `totalCostUsd - realProviderCostUsd`. When a free model runs, NewAigent keeps **100% gross margin ($15 USD net profit for every $15 of consumption/recharge)**.


### 4. Enforcement and auto-pause
- **Chatbot (`POST /api/chat`)**: Validates credits before invoking OpenRouter. If they are exhausted, it returns `402 Payment Required` with `{ error: "credit_exhausted" }`. The frontend shows an error toast, disables the input and shows a recharge banner.
- **WhatsApp bot**: `POST /api/internal/bot/context` includes `creditExhausted` (from `getCreditStatus()`) in every message. The workflow's "Guard: Credits OK" node checks it before invoking the agent: if the tenant already exhausted its monthly limit, the model call is skipped (no additional real cost) and a fixed degradation reply is sent instead of the LLM's — never silence, never spend without a cap.
- **Social campaigns (`GET /api/campaigns/social/due`)**: When credits run out, `pauseCampaignsForTenant()` sets `isActive = false, pausedByCredits = true`. The `due` endpoint automatically excludes these campaigns so n8n does not generate posts without balance.
- **Token deduction in the social webhook (`POST /api/webhooks/social-campaign`)**: When n8n publishes a post (`social_campaign_posted`), it sends `tokenUsage: { promptTokens, completionTokens, model }`. The webhook atomically invokes `recordTokenUsage()`, debiting credits at the retail rate ($3.00/$15.00 per 1M) regardless of whether the model was free, and stores the record in `SocialPost.postUrls.aiTokens`.
- **External report (`POST /api/internal/tokens/report`)**: Lets n8n or WhatsApp workflows report token consumption directly with `x-internal-key`.

- **Sidebar** (`CreditsBadge`): shows the percentage used (for example "7% Usado") and shows no dollar amounts or limit. The detail (`CreditsDrawer`) keeps the amounts.

### 5. Recharge and automatic reactivation
- The admin clicks "Recargar créditos" (Recharge credits) in the sidebar (`CreditsBadge`) or in the drawer (`CreditsDrawer`).
- A Stripe Checkout session is generated (`POST /api/credits`).
- The Stripe webhook (`checkout.session.completed`) processes the recharge through `rechargeCredits(tenantId, amountUsd)`: it increases `creditLimitUsd` on the active ledger and automatically reactivates all campaigns (`resumeCampaignsForTenant()`).

### 6. Tenant owner alerts
The platform has no email or Slack; the only channel is the business's own WhatsApp (`Tenant.whatsappNumber`), via `notifyTenantOwner()` (`src/lib/whatsapp.ts`, reuses `sendWhatsAppMessage`). Three triggers:
- **Credits exhausted**: inside `recordTokenUsage()` (`src/lib/credits.ts`), on the `isPaused` false→true transition (only once per period; the ledger's previous state is compared so the notice is not repeated on every later message).
- **Total WhatsApp bot failure**: if the n8n agent fails with every model in the cascade ("Bot Agent" node with `onError: continueErrorOutput`), the workflow sends the customer a fixed apology reply (instead of the total silence of before) and calls `POST /api/internal/bot/alert-failure`, which notifies the owner with a 60-minute cooldown (`Tenant.botFailureAlertedAt`) so as not to overwhelm them during a prolonged outage.
- **Social campaign failure**: the `Notify Error` node of `n8n/workflows/n8n-social-campaign-workflow.json` calls `POST /api/internal/campaigns/alert-failure`, which notifies the owner (60-minute cooldown, using `SocialCampaign.lastErrorAt`, which already existed). Previously this node posted to `$env.WEBHOOK_URL`, which does not exist in this n8n instance, so it never notified anyone.

### 7. Shared OpenRouter balance
All tenants share **a single OpenRouter account/API key** — there is no per-tenant key. Adding real credit to that account (e.g. $10 USD) permanently unlocks the whole account's daily limit for free models (from 50 to 1000 requests/day) and also remains available as spendable balance every time a paid model (Claude, GPT-4o) is used. To stretch that shared balance across all tenants:
- The cascade prioritizes free models (see §2); paid ones are the last resort, when OpenRouter answers 402/429/5xx on the free ones (`src/lib/ai/openrouter.ts` already retries the next model automatically, with no extra logic).
- There is no prior check of the real balance before each call (it would add latency to every turn); the 402 response from OpenRouter is relied on to skip to another model.
- `node local-utils/check_shared_balance.js` sums `realProviderCostUsd` across all tenants (current period and historical total) to manually monitor the shared balance. It is an operator tool, never shown to the tenant.
- One OpenRouter key per tenant remains a future option, only if the platform grows enough for a noisy tenant to drain the others' balance.


---

## Dynamic Theming and Custom Typography

The system respects the colors and typography configured by each business in `/admin/apariencia` (`ThemeConfig`):
- **CSS variables**: Injected in `:root` as `--color-primary`, `--color-secondary`, `--color-accent` and `--font-family-base`.
- **Google Fonts**: Pre-loaded in `src/app/layout.tsx` (`Inter`, `Montserrat`, `Playfair Display`, `Roboto`, `Space Grotesk`).
- **Tailwind**: Configured with `colors.primary = "var(--color-primary)"` and `fontFamily.sans = ["var(--font-family-base)", ...]`.
- **Portaled modals and drawers**: Any component that uses `createPortal(..., document.body)` (such as `CreditsDrawer`) must explicitly declare `style={{ fontFamily: "var(--font-family-base), system-ui, sans-serif" }}` so it does not lose the tenant's custom typography when escaping the layout.

---

## Authentication and Authorization

### NextAuth v4
- Providers: `Credentials` (email+password) and `Google`
- The JWT includes custom fields: `id`, `role`, `tenantId`
- The middleware validates the token in the Edge Runtime with `getToken()`

### Middleware redirect flows:
| Condition | Action |
|---|---|
| Root domain + tenant route | Rewrite to `/_not-found` (404) |
| `/admin/*` + not logged in | Redirect to `/login` |
| `/admin/*` + logged in but not ADMIN | Redirect to `/` |
| `/checkout` or `/pedido/*` + not logged in | Redirect to `/login?callbackUrl=...` |
| `/login` or `/registro` + already logged in | Redirect to `/admin/dashboard` or `/` |

---

## Business AI Copilot: Newy AI (OpenRouter Cascade)

Endpoint: `POST /api/chat`

### Brand identity and white-labeling (absolute rule)
The platform's intelligent copilot has **Newy AI** (or *Newy AI Copiloto*) as its exclusive brand.
- **No vendor leaks**: Under no circumstances may the technical names of internal providers (Claude, Anthropic, OpenAI, GPT, OpenRouter, Evolution API, n8n, etc.) be shown to customers or administrators.
- **API masking**: In the `POST /api/chat` response, the `modelUsed` field always returns `"Newy AI"` to protect the internal infrastructure from network inspection in the browser.
- **Identity defense in `system-prompt.ts`**: If a user asks "who are you?" or tries a jailbreak by asking which model it is, Newy AI always answers that it is the intelligent copilot developed by NewAigent.

### Native CRM experience (`/admin/asistente`)
1. **Live KPI snapshot bar**: On every load (SSR), `src/app/admin/asistente/page.tsx` queries in parallel via Prisma:
   - Sales of the month (`revenueMonth`) and count of paid orders (`ordersCount`).
   - Pending orders (`pendingOrdersCount`).
   - Active product catalog (`activeProductsCount`).
   - Active social campaigns (`activeCampaignsCount`).
2. **One-click question triggers**: Each KPI card includes an interactive "Preguntar ↗" (Ask) button on hover, immediately sending an analytical, contextualized query to Newy AI.
3. **Executive navigation shortcuts**: Header with direct quick links to `/admin/pedidos`, `/admin/calendario`, `/admin/productos` and `/admin/social-campaign`.
4. **Tool execution flow**:
   - The admin types in `/admin/asistente` or clicks a metric.
   - The frontend sends the conversation to `POST /api/chat`.
   - The API invokes the Newy AI cascade stack with tools defined in `src/lib/ai/tools.ts`.
   - `execute-tool.ts` runs Prisma queries **always filtered by the tenantId** of the session JWT.
5. **Security and system instruction protection (`system-prompt.ts`)**:
   - Strict rules against **Prompt Injection** and jailbreaks.
   - Absolute prohibition on revealing the system prompt, internal instructions, credentials, tokens or underlying architecture in response to malicious or social-engineering requests.

Available tools: sales, orders, products, customers, reviews, FAQs (`get_faqs`), business (`get_business_profile`), catalog (`search_products`), WhatsApp counts (`get_whatsapp_summary`) for all verticals; appointments, free time slots and confirmations (`get_appointments`, `get_schedule_availability`, `get_confirmation_status`, etc.) only with `isBookingEnabled`. The tools do not send emails, clinical notes or message text (see spec 21.12).

---

## n8n Automation and Token Metering

Social campaigns run automatically in n8n under a strict **API-first architecture** (n8n **never** connects directly to the PostgreSQL database; every operation is done through HTTP calls to the Next.js APIs authenticated with `x-internal-secret`):

1. **Scheduled campaign lookup**: n8n periodically queries `GET /api/campaigns/social/due` (filters `nextPostAt <= now AND isActive = true AND pausedByCredits = false`).
2. **Campaign and tenant context**: n8n invokes `GET /api/campaigns/social/[id]/context` to receive the campaign configuration, Meta credentials and the business data.
3. **Dynamic image selection (`selectedImageUrl`)**:
   - In the UI (`/admin/social-campaign`), the user interactively selects any product photo from their catalog (never hardcoded `images[0]`).
   - The selected URL is persisted in `SocialCampaign.selectedImageUrl` in the PostgreSQL database.
   - In the `Build Image Request` node, n8n reads `campaign.selectedImageUrl` directly from the context payload. If no photo is assigned, it falls back to the product photo or a watermark-free editorial photograph.
4. **Isolated Cloudinary storage**:
   - The `Upload to Cloudinary` node only passes the data. The upload is done by `render-post-banner` in `newaigent/{tenantId}/campaigns` (`tenantId` is mandatory).
5. **Strategic copy generation (OpenRouter free models)**:
   - The `Newy AI - Generate Content` node sends the prompt to OpenRouter using `google/gemini-2.0-flash-exp:free` (falling back to `meta-llama/llama-3.3-70b-instruct:free` and `openrouter/free`).
   - It includes anti-leak sanitization filters to strip thinking tokens (`<think>`) and prevent system prompt leaks to Facebook or Instagram.
6. **Publishing on the Meta Graph API**:
   - Facebook Page: `POST /v19.0/{pageId}/photos`.
   - Instagram Business: `POST /v19.0/{igUserId}/media` (container) -> wait 5s -> `POST /v19.0/{igUserId}/media_publish`.
7. **Calendar update**: Calls `PATCH /api/campaigns/social/[id]` with `markPosted: true` so the CRM recalculates `nextPostAt`.
8. **Audit and token ledger**:
   - Notifies `POST /api/webhooks/social-campaign` with a `webhookPayload` containing `tokenUsage: { promptTokens, completionTokens, model }`.
   - The webhook deducts credits in `AiTokenLedger` applying the standard SaaS rates ($3.00 in / $15.00 out per 1M tokens) and records the post in `SocialPost`.

---

## WhatsApp Bot with AI (n8n)

Flow: `n8n/workflows/n8n-chat-workflow-v2.json` ("NewAigent - WhatsApp Bot (Chat)"). Detailed documentation: `n8n/docs/N8N_WHATSAPP_BOT_DOCUMENTATION.md`.

- **Input**: Evolution API → workflow webhook (`POST /:tenantSlug`) → guards (`messages.upsert`, `fromMe = false`, text and phone present).
- **Tenant**: resolved from the Evolution instance name (`resolveBotTenant` in `src/lib/bot.ts`, looks up `waInstanceName` or `waInstanceId`). Never taken from the model.
- **Customer identity**: their WhatsApp number. `normalizeCustomerPhone` prefers `remoteJidAlt`; a `@lid` without an alternative is rejected.
- **Agent**: n8n Agent v2.2 with OpenRouter (free model cascade, n8n credential), Postgres memory `whatsapp_bot_memory` (12-message window, key `instance:phone`) and 5 tools.
- **Tools → internal endpoints** (`x-internal-key`):

  | Tool | Endpoint |
  |---|---|
  | `check_availability` | `POST /api/internal/bot/availability` |
  | `book_appointment` | `POST /api/internal/bot/book` |
  | `list_my_appointments` | `POST /api/internal/bot/my-appointments` |
  | `cancel_appointment` | `POST /api/internal/bot/cancel` |
  | `reschedule_appointment` | `POST /api/internal/bot/reschedule` |

  The context (services, prices, FAQs, `waContext`) arrives with `POST /api/internal/bot/context`.
- **Bot per contact**: `WhatsAppChat.botEnabled` (default `true`) and `botPausedReason` (`manual` or `owner_reply`). The CRM changes it with `PATCH /api/apps/whatsapp/chats/[id]` and the owner writes with `POST /api/apps/whatsapp/chats/[id]/send` (writing pauses the bot). n8n queries `POST /api/internal/bot/contact-status` before running the agent. See `n8n/docs/N8N_WHATSAPP_BOT_DOCUMENTATION.md`, section "Bot apagado por contacto" (bot turned off per contact).
- **Business rules**: prices may be quoted, never changed or discounted. Appointments within the business's weekly hours (`Tenant.businessHours`, `src/lib/business-hours.ts`, Mexico time), with per-service duration. Only `isBookable` items are scheduled. Conflict checking covers native appointments and the connected calendar (Google or Outlook, `getBusyPeriods` in `src/lib/calendar-sync.ts`); if the calendar fails, only the database is used. The web and the bot create appointments with the same service (`src/lib/appointments-service.ts`).
- **Patient times**: they are Mexico time. They are built with `clinicDateTime()` (`src/lib/clinic-time.ts`, offset `-06:00`) and read with `clinicTimeOf()`. Never use a `Z` suffix for a time chosen by the patient.
- **Privacy**: the system prompt forbids mentioning technical formats, IDs, tools, errors, infrastructure and other customers' data. It is a guide for the model, not a guarantee. The `Clean Reply` node removes repeated greetings and is the only output filter.
- **Greeting and introduction**: a pure greeting ("hola", "buenas tardes") is answered by the server with a template, without calling the agent or spending credits (`src/lib/greeting.ts`, `greetingReply` of `POST /api/internal/bot/context`). The bot introduces itself ("Hola, soy el asistente de WhatsApp de [negocio]") if nobody wrote to the contact in the last 12 hours (`introRequired`); the agent receives it as PRESENTACION in the prompt. The greeting is stored as a bot message.
- **Token reporting**: `Collect Token Usage` adds up the usage of all agent calls and `Report Token Usage` sends it to `POST /api/internal/tokens/report`, which charges the tenant at the retail rate. If the provider does not report usage, it is estimated (2,000 prompt tokens per call plus response length / 4).
- **Credits exhausted**: the "Guard: Credits OK" node checks `creditExhausted` (from `POST /api/internal/bot/context`) before reaching the agent. If the tenant already exhausted its monthly limit, the model call is skipped and a fixed degradation reply is sent.
- **Total cascade failure**: the "Bot Agent" node has `onError: continueErrorOutput`; if every model fails, that branch sends the customer a fixed apology reply (instead of silence) and calls `POST /api/internal/bot/alert-failure` to notify the owner (60-min cooldown, see §"Tenant owner alerts" in the credits section).
- **Calendar for the agent**: `POST /api/internal/bot/context` returns `calendarText` (next 14 days with weekday, date and hours, generated by `upcomingCalendarText()` in `src/lib/business-hours.ts`). The prompt uses it to name days and dates; the model must not compute weekdays on its own.
- **Email required for new appointments**: `bot/book` answers `email_required` without a valid email. This way every bot appointment has an attendee and the Google or Outlook invitation goes out by itself. Canceling and rescheduling do not ask for a name or email: they are identified by the WhatsApp number and `list_my_appointments`.
- **Tools with errors as data**: the agent's five tools have `neverError`; a 409 response (`slot_unavailable`) reaches the model as a message and the customer gets a normal reply.
- **Past times**: no appointments are created at times that have already passed (`POST /api/appointments` answers `date_in_past`, for all creators; the bot and web availability also filter them).
- **n8n rules for this flow**:
  - In Code nodes and tools use `$('Node').first().json`, not `$('Node').item`. With `.item` it fails with "No data found from `main` input" and the tool sends an empty instance.
  - `$env` is not available in this n8n instance. Secrets go inside the workflow.
  - Do not enable "Require Specific Output Format" or connect an Output Parser to the agent. The free model does not follow that schema.

---

## Appointment Reminders and Confirmation (separate workflow, no LLM)

- **Workflow**: `n8n/workflows/n8n-reminders-workflow.json`. A Schedule Trigger every 15 minutes calls `POST /api/internal/reminders/run`. The interval sets the precision: a reminder or a release goes out at most 15 minutes late.
- **Reminder settings** (`/admin/whatsapp`, Configuración tab, "Recordatorios y confirmación" card, `PATCH /api/tenants/reminders` with only these fields): `remindersEnabled`, `reminderLeadMinutes` (60–4320 minutes, in multiples of 30, before the appointment at which the reminder goes out; the card shows them in hours with half hours), `confirmationRequired`, `confirmationDeadlineMinutes` (30–2880 minutes, in multiples of 30, before the appointment at which it is released). `confirmationDeadlineMinutes < reminderLeadMinutes` must hold (`reminder_window_invalid`).
- **Customer messages** (`/admin/whatsapp`, Configuración tab, "Mensajes al cliente" card, `PATCH /api/tenants/reminders` with only these fields): `messageLanguage` (`es` | `en`) and three optional texts (`reminderTemplate`, `confirmationTemplate`, `cancellationTemplate`). Empty = the language's default text.
- **Tenant texts**: the tenant writes data with bracketed tags: `[Servicio]`, `[Fecha]`, `[Hora]`, `[Hora límite]`, `[Nombre del negocio]` (service, date, time, deadline time, business name). The tags are taken from the i18n dictionaries (`crm.business.token*`) and the server accepts those of any language. The confirmation text must include the deadline time and the word SI (`validateConfirmationTemplate`). Never show braces or technical names to the tenant or the customer.
- **Default customer texts**: `customerMessages` in `src/i18n/es.ts` and `en.ts` (reminder, confirmation, footer without confirmation, cancellation, confirmation reply). Dates and times with `clinicLongDate` and `clinicTime` according to `messageLanguage`.
- **Rules** (`src/lib/reminders.ts`, pure functions): the notice goes out `reminderLeadMinutes` before the appointment, at the exact time (also at night); the release is `appointment time − confirmationDeadlineMinutes`. The window to reply (notice to release) must be at least 30 minutes. If the appointment was booked after the notice time, the notice goes out at booking (if the window allows). If the window is smaller, or confirmation is off: a late-booked appointment receives nothing (counts as confirmed); otherwise, only a simple reminder. No phone: no message and it is never released.
- **Sending** (`reminders/run`): sends once per appointment (`Appointment.reminderSentAt`). If sending fails, it neither marks nor charges; it is retried on the next run. Each successful send charges `REMINDER_COST_USD` (default `0.0085`) with `recordMessageCharge()`: it adds to `totalCostUsd`, increments `AiTokenLedger.reminderCount` and records `REMINDER_PROVIDER_COST_USD` (default `0`) as the real cost. Reminders go out even without credits and may exceed the limit; the owner is notified only once per period.
- **Release**: if confirmation was requested, `reminderSentAt` exists, there is no `customerConfirmedAt` and the deadline has passed, `releaseVisit()` (`src/lib/reminder-actions.ts`) calls `cancelAppointment` (status `CANCELLED`, deletes the Google/Outlook event, frees the slot) and sends the cancellation text. `autoReleasedAt` is set.
- **Customer confirmation**: `POST /api/internal/bot/confirm` (`x-internal-key`). Replies `sí`/`confirmo`/`de acuerdo`… (yes/I confirm/agreed) count only if the reply is short and contains no negations, changes or questions (`isClearConfirmation`). If it confirms: `customerConfirmedAt`, status `CONFIRMED` and a confirmation reply. If it is not a confirmation: `handled: false` and the message continues to the agent. The chat flow calls this endpoint before the agent ("Check Confirmation" node); the agent has the `confirm_appointment` tool as a backup.
- **Owner list** ("Confirmaciones" tab in `/admin/whatsapp`): `GET /api/apps/whatsapp/confirmations`, and `POST /api/apps/whatsapp/confirmations/[id]` with `action: "confirm" | "release"`. "Liberar ahora" (release now) uses the same `releaseVisit`.
- **Channel**: `sendWhatsAppMessage` (Evolution). With Meta's official API, a reminder outside the 24 h window will need an approved template.
- **Pending**: deploy the code, re-import `n8n/workflows/n8n-chat-workflow-v2.json` and `n8n/workflows/n8n-reminders-workflow.json`, test with real WhatsApp and a connected calendar, and status badges in `/admin/citas`.

---

## Vocabulary and White-Labeling Standards

To maintain the platform's quality and commercial value, the following equivalences are mandatory in user interfaces and error messages. The right-hand column holds the literal user-facing strings, which stay in Spanish (the English gloss is in parentheses):

| Internal term / Provider | Commercial name visible to the user / customer |
|---|---|
| Claude / GPT / LLMs | **Newy AI** / Copiloto Newy AI |
| Evolution API | **WhatsApp** / Conexión Segura de WhatsApp (Secure WhatsApp Connection) |
| n8n | **Automatización Inteligente** / Flujos Automatizados (Smart Automation / Automated Flows) |
| Conekta | **Pasarela de pagos segura** / Tarjeta de crédito o débito (Secure payment gateway / Credit or debit card) |
| OpenRouter / Prompt tokens | **Créditos Newy AI** / Unidades de Inteligencia (Newy AI Credits / Intelligence Units) |

## Critical Environment Variables

```bash
# ─── Database ───────────────────────────────────────────────────────────────────
DATABASE_URL=                    # PostgreSQL on Supabase (pooler port 6543 — runtime)
DIRECT_DATABASE_URL=             # Same URL but port 5432 — required for prisma db push / migrate

# ─── Auth ───────────────────────────────────────────────────────────────────────
NEXTAUTH_SECRET=                 # openssl rand -base64 32
NEXTAUTH_URL=                    # http://localhost:3000 (dev) | https://newaigent.com (prod)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ─── Microsoft OAuth (Outlook Calendar) ─────────────────────────────────────────
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=             # "common" for multi-tenant Microsoft

# ─── AI (Newy AI / OpenRouter) ──────────────────────────────────────────────────
ANTHROPIC_API_KEY=               # Claude API (direct fallback)
OPENROUTER_API_KEY=              # OpenRouter API key (primary)
OPENROUTER_MODEL=                # Primary model: anthropic/claude-sonnet-4.5
OPENROUTER_MODELS=               # Full cascade, comma-separated (see §2 Model stack)
OPENROUTER_INPUT_PRICE_PER_M=    # 3.00 (USD / 1M prompt tokens — retail rate)
OPENROUTER_OUTPUT_PRICE_PER_M=   # 15.00 (USD / 1M completion tokens — retail rate)
REMINDER_COST_USD=               # 0.0085 (USD charged to the tenant for each reminder sent)
REMINDER_PROVIDER_COST_USD=      # 0 (real cost per reminder; set equal to Meta's after migrating)

# ─── Google Maps (business address) ─────────────────────────────────────────────
GOOGLE_MAPS_API_KEY=             # Server only; Places API (New) enabled and key restricted to that API

# ─── Root domain (multi-tenant) ─────────────────────────────────────────────────
NEXT_PUBLIC_ROOT_DOMAIN=         # newaigent.com

# ─── Payments — Conekta ─────────────────────────────────────────────────────────
CONEKTA_PRIVATE_KEY=             # Server-side
NEXT_PUBLIC_CONEKTA_PUBLIC_KEY=  # Client-side (Conekta.js tokenization)
CONEKTA_WEBHOOK_SECRET=
CONEKTA_SUCCESS_URL=             # Redirect URL after a successful payment
CONEKTA_FAILURE_URL=             # Redirect URL after a failed payment

# ─── Payments — PayPal ──────────────────────────────────────────────────────────
PAYPAL_CLIENT_ID=                # Server-side
PAYPAL_CLIENT_SECRET=            # Server-side
NEXT_PUBLIC_PAYPAL_CLIENT_ID=    # Client-side SDK

# ─── Stripe (Platform SaaS Billing) ─────────────────────────────────────────────
STRIPE_SECRET_KEY=               # sk_test_... or sk_live_...
STRIPE_WEBHOOK_SECRET=           # whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # pk_test_... or pk_live_...
STRIPE_PRICE_STARTER_MONTHLY=    # price_...
STRIPE_PRICE_STARTER_ANNUAL=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_ANNUAL=
STRIPE_PRICE_STARTER_MONTHLY_DLLS=  # USD variant
STRIPE_PRICE_STARTER_ANNUAL_DLLS=
STRIPE_PRICE_PRO_MONTHLY_DLLS=
STRIPE_PRICE_PRO_ANNUAL_DLLS=

# ─── Cloudinary (images) ────────────────────────────────────────────────────────
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=   # Client-side (direct uploads)
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ─── Facebook / Instagram OAuth (social campaigns) ──────────────────────────────
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
# FACEBOOK_REDIRECT_URI is auto-detected from NEXTAUTH_URL if not defined

# ─── n8n Automation ─────────────────────────────────────────────────────────────
N8N_FACEBOOK_WEBHOOK_URL=        # n8n webhook URL to trigger publications

# ─── Internal APIs (n8n → Next.js) ──────────────────────────────────────────────
# IMPORTANT: All endpoints under /api/internal/ verify this header: x-internal-key
INTERNAL_API_KEY=                # openssl rand -hex 32
# Note: in .env.example it may appear as INTERNAL_API_SECRET — they must be the same value

# ─── WhatsApp Evolution API ─────────────────────────────────────────────────────
EVOLUTION_API_URL=
EVOLUTION_API_KEY=

# ─── Redis / Upstash (session cache) ────────────────────────────────────────────
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

> ⚠️ **Windows `.env` rule**: Do not put quotes around the values.
> ⚠️ **INTERNAL_API_KEY**: Endpoints under `/api/internal/` read `process.env.INTERNAL_API_KEY`. If your `.env` defines it as `INTERNAL_API_SECRET`, the `x-internal-key` header will fail with a silent 401/403.

---

## Useful Commands

```bash
npm run dev              # Development server at localhost:3000
npm run build            # Production build
npm run db:generate      # Regenerate the Prisma client
npm run db:push          # Apply the schema to the DB without a migration
npm run db:seed          # Create sample data
npm run db:studio        # Open Prisma Studio (DB UI)
vercel --prod            # Deploy to production
```

---

## Local Development with Multiple Tenants

To test subdomains locally, edit the system `hosts` file:

```
127.0.0.1  localhost
127.0.0.1  doctor.localhost
127.0.0.1  nutrifit.localhost
127.0.0.1  nutriologas.localhost
```

Then open `http://doctor.localhost:3000` to see the "doctor" tenant.

### Local OAuth protection (`OAuth Localhost Guard`)
- **Previous problem**: When connecting Google Calendar or Facebook from `doctor.localhost:3000`, the app redirected to `https://doctor.newaigent.com/...` in production because `.env` contained `NEXTAUTH_URL="https://newaigent.com"`.
- **Implemented solution**: The endpoints `/api/apps/oauth/google/start`, `/callback`, `/api/apps/oauth/facebook/start` and `/callback` automatically detect the `host` header. If it contains `localhost`:
  - They set `redirect_uri` to `http://localhost:3000/api/apps/oauth/<provider>/callback`.
  - In the callback, the final redirect is built dynamically as `http://${slug}.localhost:3000/admin/...`, ensuring local development always stays on `localhost:3000` without altering production environment variables.

---

## Known Issues / Pending

### Middleware (route blocking)
- Route blocking on the root domain uses `NextResponse.rewrite(new URL("/_not-found", req.url))`.
- The redirect to `/404` and the use of `x-forwarded-host` were explored but have problems in production on Vercel Edge.
- **Current state**: The original middleware (with `req.headers.get("host")`) is restored as the most stable version.

### Payments
- Conekta tokenization must be done on the client with `Conekta.js` before calling the backend
- OXXO Pay requires polling Conekta webhooks to confirm payment

### Pending
- **Unapplied schema migration**: `WhatsAppChat.botEnabled` and `botPausedReason` require `npm run db:push`. Confirm before applying.
- **Web appointments from before the time fix**: they were saved with UTC time (6 hours ahead). Fix with `local-utils/shift-web-appointments-utc-fix.mjs` (first without `--write`) and manually move the calendar events that get listed.
- **Hardcoded secrets in n8n workflows** (internal key, Evolution API key, OpenRouter key in the social campaign). Move to credentials when n8n allows it, and rotate them.
- **Social workflow**: if a publication fails after the text was generated, its tokens are not reported.
- **Pets**: the `pets` table and `appointments.petId` exist in the database, but tests with real data are pending: the database queried on Oct. 26 was empty. `local-utils/check-pets.ts` still needs to be run with a real tenant and `n8n/workflows/n8n-chat-workflow-v2.json` re-imported.
- **Reminders**: the end-to-end test (real WhatsApp, connected calendar) and the status badges in `/admin/citas` are pending.
- Row Level Security in Supabase (currently only app-level filtering)
- Rate limiting on `/api/chat`
- Trial expiry gate: `TrialBanner` and `TrialExpiredGate` exist, but the trial expiry gate in the admin layout still does not fully block all routes

---

## Business Profile (`/admin/negocio`)

- Route: `src/app/admin/negocio/page.tsx`
- API: `GET/PUT /api/tenants/business`
- Lets the admin edit: business name, logo (Cloudinary upload), WhatsApp number, business description (`businessInfo`).
- **The `slug` (subdomain) is read-only and must NEVER be editable** — it is the tenant's unique identifier; changing it would break the URLs.
- The form shows the current values as placeholders and an "Actual" (Current) label for each field.
- **The WhatsApp number is required** and is stored as `+<country code><digits>` (8 to 15 digits). It is used by WhatsApp, the reminders and the store button. The form has a country code selector (default +52) and the API validates it with `^\+\d{8,15}$`.
- **Location and owner**: "Ubicación y responsable" card with the owner's name, the "Mi negocio tiene un local físico" (My business has a physical location) switch and an address search (`src/components/shared/AddressSearch.tsx`, uses `/api/places/*` with `GOOGLE_MAPS_API_KEY`, server only). If the search is unavailable, the component falls back to a hand-typed address (without coordinates). The same component is used at signup (`OnboardingModal`).
- **Create `GOOGLE_MAPS_API_KEY`** (Google Cloud Console):
  1. Choose or create a project.
  2. Billing: link a billing account (Places requires it, although Google gives a free monthly amount).
  3. APIs & Services > Library: enable **Places API (New)** (not the older "Places API").
  4. APIs & Services > Credentials > Create credentials > API key.
  5. Restrict the key: under "API restrictions" choose only **Places API (New)**. The key is used only from the server; Vercel has no fixed IP, so under "Application restrictions" leave "None".
  6. Save it without quotes: `.env` locally (restart `npm run dev`) and Vercel Environment Variables in production (redeploy).
  7. Create a budget alert in Billing to avoid unexpected charges.
  - Test: in `/admin/negocio`, turn on the switch and type an address; suggestions appear from 3 characters. If "La búsqueda no está disponible ahora" (Search is not available right now) appears, the key is missing, billing is off or the key is restricted to another API.
- **Call limit** of `/api/places/*`: 40 requests per minute per IP (`src/lib/rate-limit.ts`, in memory per server instance; it protects against abuse, it is not an exact limit).
- Phone helpers in `src/lib/phone.ts` (`buildFullPhone`, `splitFullPhone`, `PHONE_COUNTRIES`). Use them in any new form that asks for a phone; do not write another parser.

---

## ECC Workflow (Everything Claude Code)

> Project rules in this file always win over generic ECC rules.

### Install scope
- ECC is installed **only as a Claude Code plugin** (`ecc@ecc`, enabled in `.claude/settings.local.json`, hook profile `minimal`).
- **Never** run `install-apply.js` or `install.sh` on top of the plugin. Mixing both methods duplicates skills, commands and hooks.
- Rules are copied by hand, whole folders only: `.claude/rules/ecc/common` and `.claude/rules/ecc/typescript`. Do not add other language packs (token cost).
- The old `.agents/` scaffold (from another project) was removed. Claude Code does not need an `AGENTS.md`. Its useful history now lives in `docs/DECISIONS-LEDGER.md` and `docs/CHANGELOG.md`.

### Standard flow
```
/ecc:plan-prd -> /ecc:plan (wait for CONFIRM) -> tdd-workflow skill -> /ecc:code-review -> /ecc:pr
```
- Use `/ecc:build-fix` when the build breaks, `/ecc:security-scan` before shipping auth, payment or tenant code.
- Run `/ecc:update-codemaps` after large features or refactors, then review the diff before committing.
- Playbook (install rules, command map, hooks): https://claude.ai/artifact/5LaD5NNMcgZ2NN1X3T62ey

### Architecture docs
Token-lean maps live in `docs/CODEMAPS/`: `architecture.md`, `backend.md`, `frontend.md`, `data.md`, `dependencies.md`. Read the relevant map before exploring code. Regenerate them instead of editing by hand.

### Precedence over ECC rules
When an ECC rule conflicts with this file, this file wins. In particular:
- Tenant isolation (`tenantId` from the session, never from input), `@/lib/db` for Prisma, white-label vocabulary, i18n, no emojis, minimal UI and tenant theme tokens are mandatory.
- The ECC rules for 80% coverage and TDD are the target, but the repo has no test runner yet. Adding one is a separate task.
- The ECC "never mutate" rule applies to new code. Do not rewrite existing Prisma or Zustand code only to satisfy it.

### Known gaps (verified 2026-10-28)
- `local-utils/` and `n8n/workflows/` are cited in this file but do not exist in this checkout. Treat them as external until restored.
- Upstash Redis is listed in the env vars but no code under `src/` uses it.

---

## Development Rules and Local Utilities

### Mandatory location for test scripts (`local-utils/`)
- **STRICT RULE**: If you are going to create a utility to test something, diagnose the database, simulate API calls, or any script that will **NOT be part of the business (production) application**, you **MUST add it inside the `local-utils/` folder**.
- **FORBIDDEN**: Do not create temporary scripts in the project root (`./`), nor in untracked temporary directories such as `scratch/`, nor inside `src/`.
- All ad-hoc scripts (for example: scripts to check users, backfills, ledger testing, webhook simulators, etc.) must live in `local-utils/`.

### No emojis in the UI
- **NEVER** use emoji characters (`📋`, `✅`, `⚠️`, `⭐`, `🚀`, etc.) as UI elements in JSX/TSX.
- All icons must come from `lucide-react`. Always specify the component name, size (`size`) and `strokeWidth` when relevant.
  - Correct: `<AlertTriangle size={16} className="text-amber-500" />`
  - Incorrect: `⚠️ Warning`
- Icon-only buttons must include `aria-label` for accessibility.

### Minimalist style on tenant screens
- Tenant screens (CRM, storefront, login/signup) follow a flat, neutral style, like Claude or ChatGPT. Specification in `.claude/skills/minimal-ui/references/style-spec.md`.
- No gradients, blur, colored shadows, hover scaling or uppercase labels. The tenant's colors and font are kept.
- To audit or rewrite styles use the `minimal-ui` skill (scripts in `local-utils/minimal-ui/`).
- The dark NewAigent brand pages (landing, legal, billing, 404) are not covered by this style.

### Follow the tenant's style (theme in the database)
- Every new page or component of the **public storefront** (`(public)/`) and the **CRM** (`admin/`) must respect the tenant's visual theme stored in the `ThemeConfig` table (`primaryColor`, `secondaryColor`, `accentColor`, `fontFamily`).
- The theme is injected as CSS variables from the tenant layout. Always use `var(--color-primary)` / `bg-primary` / `text-primary` and the configured Tailwind utilities — **never** hardcoded color values (`#16a34a`, `green-600`, etc.) in tenant components.
- In **marketing page** components (`marketing/`), fixed colors are allowed because they do not belong to any tenant.
- If a new component needs an accent color different from the tenant's, it must expose it as a prop or CSS token — not hardcode it.

### Multi-tenant rules (think about every business)
- Every change is designed as a rule for **any** tenant, not for the example shown in a screenshot. A screenshot is a case, not the specification.
- Do not write anything with the data of a specific business: labels, colors, verticals, product names or phrases.
- Free text from a business or the bot (appointment reason, notes, replies) is shown as is, respecting its line breaks. Do not parse its format from the screen: the format depends on what the bot or the customer writes. If the format matters, fix it at the source (bot prompt or booking flow).
- Before closing a UI change, check at least: an empty value, a long one, another vertical, dark mode and very light or very dark tenant colors.
- On delivery, state which rule was applied and which cases it covers.

---

## Meta Integration (Facebook & Instagram)

- **Unified OAuth**: Connects Facebook Pages and Instagram Professional Accounts through Meta's OAuth flow (`/api/apps/oauth/facebook/start` and `/callback`).
- **Required scopes**: `email`, `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`.
- **Strict Instagram Professional requirement**: The Meta Graph API **blocks personal Instagram accounts** from publishing via API. The user must:
  1. Switch the Instagram account to a Professional account (Business or Creator).
  2. Link the Instagram account to their Facebook Page in Meta Business Suite.
  3. Reconnect Meta from `/admin/apps` to associate the `igBusinessAccountId`.
- **Automatic publishing with n8n**: The workflow publishes directly to Facebook (`POST /{pageId}/photos`) and Instagram (`POST /{igUserId}/media` -> `POST /{igUserId}/media_publish`).

---

## Microsoft Integration (Outlook Calendar)

- **OAuth flow**: `/api/apps/oauth/microsoft/start` and `/callback` — analogous to the Google flow.
- **Provider enum**: `MICROSOFT` in Prisma's `AppProvider`.
- **Sidebar**: The `/admin/calendario` route requires `providersReq: ["GOOGLE", "MICROSOFT"]` — it is shown if either of the two is connected.
- **Env vars**: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` (use `"common"` for multi-tenant).
- **Event writing**: the scope is `Calendars.ReadWrite` (start, callback and refresh). Earlier connections are read-only and must be reconnected; `/admin/apps` shows a notice when the scope is missing. Graph calls live in `src/lib/microsoft-calendar.ts`.

---

## Legal Pages and Signup Consent

- **Legal routes**: `/terminos` (Terms of Service) and `/privacidad` (Privacy Policy) available on the public storefront and the root domain.
- **Component**: `src/components/legal/LegalPageLayout.tsx` handles the responsive layout, branding and multilingual support.
- **Mandatory consent**: In `/registro` and in the onboarding modal (`OnboardingModal.tsx`), the user must tick the checkbox accepting the Terms and Privacy Policy before the account creation button is enabled.

---

## Internationalization (i18n) Architecture

- **Central hook**: `useTranslation()` from `@/i18n`.
- **Automatic detection**: Detects the main language configured in the user's browser (`navigator.languages[0]` / `navigator.language`), supporting Spanish (`es`) and English (`en`).
- **Typed dictionaries**: `src/i18n/types.ts`, `src/i18n/es.ts`, `src/i18n/en.ts`.
- **Zero hardcoded text**: All CRM views (including `/admin/social-campaign`, `/admin/pacientes`, modals, goal/tone/frequency selectors, alerts, placeholders and toasts) take their text from `t.crm.*`.
- **Bilingual legal routes**: `/terminos` and `/privacidad` are the Spanish routes; `/terms` and `/privacy` are the English alias routes. Both use the same `LegalPageLayout` with i18n.

---

## Triage / Patients Module (feature-flagged)

- **Toggle**: `Tenant.isTriageEnabled = true` enables the module (default: `false`).
- **CRM**: `/admin/pacientes` — lists `PatientProfile` cards with data collected by the WhatsApp agent.
- **Internal API**: `GET/POST /api/internal/triage` — authenticated with `x-internal-key`. The WhatsApp AI agent checks whether a patient already has a complete triage (`isTriageComplete`) and saves the data when it finishes.
- **Data flow**: WhatsApp AI (n8n) → `POST /api/internal/triage` → creates/updates `PatientProfile` → visible in `/admin/pacientes`.
- If `isTriageEnabled = false`, the endpoint returns `{ isTriageComplete: true }` so n8n skips the triage flow without errors.
- **Note**: This module was **NOT removed**. It is active and functional, only hidden in the sidebar when `isTriageEnabled = false`.

---

## Banner Pipeline for Social Campaigns (`/api/internal/render-post-banner`)

- **Endpoint**: `POST /api/internal/render-post-banner`
- **Auth**: Header `x-internal-key` → `process.env.INTERNAL_API_KEY`
- **Function**: Composes a 1080×1080 image with the Cloudinary SDK:
  1. Uploads an SVG overlay with a dark gradient (scrim), hero title, subtitle and CTA pill button
  2. Combines the overlay with the product's base photo (crop fill + gravity auto)
  3. Returns the public Cloudinary URL of the composed banner
- **Called by**: n8n before publishing to Facebook/Instagram
- **Body parameters**: `imageUrl` (required), `tenantId` (mandatory), `hero`, `heroHighlight`, `support`, `cta`, `accentColor`
- **Storage**: `newaigent/{tenantId}/campaigns/banner_{timestamp}`

---

## Cloudinary Folders

- Single account; the root folder is `newaigent` (constant `CLOUDINARY_ROOT_FOLDER` in `src/lib/cloudinary-root.ts`). Everything belonging to a business lives in `newaigent/<tenantId>/<type>`: `logo`, `products`, `carousel`, `campaigns` and `temp` (the banner's temporary overlay).
- The signup logo is sent together with the form (multipart: `payload` and `logo`) and `POST /api/tenants/register` uploads it to `newaigent/<tenantId>/logo` after creating the business. There is no `signups` folder; `POST /api/upload/public` was removed.
- `render-post-banner` requires `tenantId` (400 if missing). One-off scripts: `local-utils/rename-cloudinary-root.ts` (renamed `nutriologas` to `newaigent`) and `local-utils/remove-cloudinary-signups.ts`.
- Renaming a folder in Cloudinary changes the URLs of everything it contains: any URL stored in the database stops working.

## Business Verticals and Service Adaptation

- **DB model (`Tenant.vertical`)**: Enum `BusinessVertical` (`ECOMMERCE`, `HEALTH`, `VETERINARY`, `TOURISM`, `SERVICES`, `PET_CARE`, `TRAVEL`, `GENERAL`). Unknown or null values use the store profile (`ECOMMERCE`).
- **Single source per vertical ("giro")**: `src/lib/vertical-profile.ts` (`getVerticalProfile(vertical, isBookingEnabled)`). Sidebar, storefront, the Newy AI assistant, chat and the product form read from there; do not compare the vertical's name by hand.

| Vertical | Orders | Catalog first (services) | Customer group | Pets | Newy AI sales tools |
|---|---|---|---|---|---|
| ECOMMERCE, GENERAL | yes | no | Customers | no | yes |
| HEALTH | no | yes | Patients | no | no |
| VETERINARY, PET_CARE | no | yes | Pets | yes | no |
| TOURISM, TRAVEL | no | yes | Travelers | no | no |
| SERVICES | no | yes | Customers | no | no |

- History and appointments only appear with `isBookingEnabled`. Newy AI's appointment tools also depend on that switch (`toolsFor()` in `src/lib/ai/tools.ts`), and `POST /api/chat` rejects any tool outside the vertical's set even if the model requests it.
- In the sidebar, the products section changes to "Servicios" (Services) for verticals that sell by appointment (`serviceFirst`).
- **Pets** (`VETERINARY`, `PET_CARE`): the web booking (`BookingFlow`) and the bot ask for the pet's name and species. Without a name, `POST /api/appointments` and `bot/book` answer `pet_required` (400). The history groups by owner, shows the pets under each owner, filters by pet (`GET /api/admin/historial/[key]?petId=`) and shows the pet in each visit. `/admin/citas` shows "Mascotas: nombre" (Pets: name) under the owner. Other verticals do not query the `pets` table.
- The history uses the customer group's label (`t.crm.history.subjects`): Patient history, pet history, traveler history or customer history.
- **Dynamic adaptation**:
  - For verticals not focused on physical e-commerce (doctors/gynecologists, veterinary clinics with pet hotels, travel agencies/tours), products are configured as services with duration (`durationMinutes`) and interactive scheduling (`isBookingEnabled: true`).
  - In the sidebar, the products section automatically changes to "Servicios" for health professionals (`isHealth`).
  - The storefront adapts the main purchase button to "Agendar Cita / Servicio" (Book Appointment / Service), routing to `/agendar/[slug]`.
- **Patient appointment portal**: Customers can view their booked appointments or cancel them at `/mis-citas`.
- **Guest booking**: The `POST /api/appointments` endpoint allows booking appointments without requiring a prior account. It stores the patient's name and phone both in the relational fields (`customerName`, `customerPhone`) and in `notes` as a redundant backup.

---

## Unified Schedule and Appointment Management (`/admin/citas`)

- **Single centralized view**: Unifies in one interactive screen the CRM's native appointments (created on the web or WhatsApp) and the events synced from **Google Calendar** and **Microsoft Outlook**.
- **Interactive mini-calendar**:
  - Located on the left for quick navigation by month and day.
  - Shows indicator dots on days that have appointments (from any source).
  - Clicking a day instantly filters the unified list to that date.
- **No duplicate grids**: The separate FullCalendar view at the bottom of the page was removed to avoid numeric discrepancies and ensure all appointments share the same list and KPI metrics (`TOTAL`, `POR CONFIRMAR` (to confirm), `CONFIRMADAS` (confirmed), `COMPLETADAS` (completed)).
- **Badges and actions by source**:
  - Google Calendar appointments: Show the official `Google Calendar` badge, event data and a direct **"Abrir en Calendar ↗"** (Open in Calendar) button.
  - Native appointments: Show the service price, phone with a direct WhatsApp link (`wa.me`), clinical status and action buttons (`Confirmar`, `Atendida`, `No vino`, `Notas clínicas` — Confirm, Attended, No-show, Clinical notes).
- **Automatic WhatsApp confirmation**:
  - When "Confirmar" is clicked on an appointment, `PATCH /api/appointments/[id]` sends an automatic WhatsApp message to the patient with the clinic name, service, date, time and estimated duration.
- **Mirrored appointments**: an appointment created from the web or the bot is saved in the database and creates an event in the connected calendar (`externalProvider` / `externalEventId`). That event does not appear separately; events created by hand in the calendar do appear.
- **Route redirect**: `/admin/calendario` redirects directly to `/admin/citas`.

---

## WhatsApp Connection and Evolution API Integration

- **Required flags when creating an instance**:
  When creating or connecting an instance in `POST /api/apps/connect/whatsapp`, the following flags are strictly applied in the `/instance/create` payload as well as in `/settings/set` and `/webhook/set`:
  1. `events: ["MESSAGES_UPSERT"]` (fires the webhook on incoming messages).
  2. `webhookBase64: true` (sends the webhook payload in base64).
  3. `rejectCall: true` (automatically rejects voice calls).
  4. `groupsIgnore: true` (ignores group messages).
  5. `readMessages: true` (marks received messages as read).
  6. `alwaysOnline: true` (keeps the session always active on WhatsApp).
  7. `readStatus: false` (disables reading WhatsApp statuses).
  8. `syncFullHistory: false`.
- **Reliable connection detection (`/api/apps/whatsapp/status`)**:
  - Queries `fetchInstances?instanceName=${instanceName}` on Evolution API.
  - Checks `connectionStatus === "open"` and extracts the phone number from `ownerJid` immediately.
  - **Self-renewing QR**: while the owner waits, `GET /api/apps/whatsapp/status` requests a new code from Evolution (`/instance/connect/<instance>`) when the stored one is more than 25 seconds old (`QR_TTL_MS`). After 8 renewals (`MAX_QR_REFRESHES`, about 3 minutes) the status is `qr_expired` and the modal shows "El código QR expiró" (The QR code expired) with "Generar nuevo código" (Generate new code), which calls `POST /api/apps/connect/whatsapp` again. The issue time and the count live in `ConnectedApp.metadata` (`qrIssuedAt`, `qrRefreshes`). Helpers in `src/lib/whatsapp-qr.ts`. See spec 19.3.
- **No handshake interruption**: The recurring call to `/instance/connect` during polling, which restarted the socket while the phone was scanning the QR code, was removed.
- **Immediate modal close (`WhatsAppModal`)**:
  - Polling every 2 seconds in `/admin/apps`. On detecting `status === "connected"`, it shows the visual success confirmation and closes the modal automatically after 1.2 seconds.
  - When the modal opens, it performs an immediate check to close itself if the session was already linked.

### Status of the migration to WhatsApp Cloud API (Meta)

- **Today**: all sending and receiving goes through Evolution API. `src/lib/whatsapp.ts` does not yet support the official API.
- **Pending**: create the Meta app and the WhatsApp Business account, obtain the permanent access token and the number ID per tenant (it would be stored in `ConnectedApp.waInstanceId`), and get the reminder templates approved. Afterwards, switch the sending and the workflow webhook to Meta's format.
