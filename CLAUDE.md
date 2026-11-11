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

> **Status (2026-11-06):** the hostname rules above live in `resolveTenantSlug` (`src/lib/tenant.ts`) and are applied by the pages and APIs themselves. The old root `middleware.ts` never ran: with `src/app`, Next.js only reads `src/middleware.ts`. So no `x-tenant-slug` or `x-session-user` header is set, and nothing reads them. The current `src/middleware.ts` only gates `/admin` by role.

### Root domain security rules

The root domain (`newaigent.com`, `www.newaigent.com`, `localhost:3000`) is **ONLY** for the marketing page. No tenant route is available there.

The following routes are **blocked on the root domain** and return 404:

```
/admin, /login, /registro, /checkout, /carrito, /pedido, /mis-pedidos, /productos, /producto
```

Valid subdomains (`doctor.newaigent.com`) have full access to every route.

> **Not active today:** this block list was in the root `middleware.ts`, which never ran (see above), so these routes answer normally on the root domain. Turning it on (the list now also needs `/recuperar`) is a separate ticket: it changes behavior for every tenant and the Google sign-in callback lands on the root domain.

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
      appointments/availability ← GET slot calculation based on schedule and duration: `allSlots` (every start time) and `availableSlots` (free ones); the booking page shows taken times as disabled
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
        reminders/run   ← POST: Sends reminders, charges for each one and releases unconfirmed appointments (every 15 min from n8n, no LLM). Answers 502 when every attempted send failed; body `{ dryRun: true }` lists the work without acting
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
  sql/                  ← Manual schema changes, one folder per change with up.sql and down.sql (see "Schema changes")
tests/                ← Tests (`*.test.ts`, node:test, tracked). local-utils/ ← operator scripts, simulators and diagnostics: in .gitignore, never committed

src/middleware.ts       ← /admin gate by role (src/lib/permissions.ts). The root-domain rules are not active (see "Root domain security rules")
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
- `serviceModes` (`ServiceModes`: `IN_PERSON`, `ONLINE`, `BOTH`; default `IN_PERSON`) → how the business sees patients. Set by the owner in `/admin/negocio`. With `BOTH` the bot and `/agendar` ask each visit; with one mode the modality is set by itself (`resolveModality`).
- `aiCreditLimitUsd` → optional override of the monthly AI credit cap (null = use the plan's)
- `botFailureAlertedAt` → last time the owner was told the WhatsApp bot failed (60-minute cooldown, see §"Tenant Owner Alerts")
- `remindersEnabled` → enables WhatsApp appointment reminders (default: true)
- `reminderLeadMinutes`, `confirmationRequired`, `confirmationDeadlineMinutes`, `reminderTemplate`, `confirmationTemplate`, `cancellationTemplate`, `messageLanguage` → reminder and confirmation settings (see "Appointment Reminders and Confirmation"). `reminderMode` and `reminderSendTime` are legacy.
- `reminderOffsetsMinutes` → legacy: no longer used (replaced by `reminderLeadMinutes`)
- `businessHours` → weekly opening hours (JSON, a list of `{start, end}` blocks per day; empty list = closed; several blocks per day = lunch break). Edited by the admin in `/admin/negocio`. Null in the field = default hours (Monday to Saturday 09:00 to 18:00). Read by the web, the storefront homepage ("Opening hours" row, shown when booking is on or the vertical is service-first) and the bot through `src/lib/business-hours.ts`. Start times (`daySlots`) step by the service duration and a session must end before its block closes. Pending: `npm run db:push`.
- `ownerName`, `hasPhysicalLocation`, `address`, `placeId`, `latitude`, `longitude` → owner or person in charge and business location (address chosen with Google Maps). The address only exists with `hasPhysicalLocation = true`; turning it off clears it. Captured at signup and in `/admin/negocio`, shown on the store homepage, and the WhatsApp bot receives them in `bot/context` (`ownerName`, `locationText`). Helpers in `src/lib/location.ts` (`locationSchema`, `directionsUrl`, `locationTextForBot`).

### User
- Belongs to a single tenant
- `role`: `CUSTOMER` | `ADMIN` | `STAFF`
- `STAFF` (ticket #21) is a team member, shown as "Asistente" in health, "Guía" in tourism and travel, "Personal" elsewhere (`staffTitle` in `src/lib/vertical-profile.ts`). It opens only Citas, WhatsApp and Historial (Historial still needs its plan and owner activation), never receives clinical notes (`internalNotes`, visit notes, notes counts), cannot delete appointments or chats, and sees no billing or credits. One permission map, `src/lib/permissions.ts`, is read by the middleware, pages, sidebar, client hooks and APIs; API guard `requirePermission` in `src/lib/permission-guard.ts`. Tests: `tests/permissions.test.ts`, `tests/staff-title.test.ts`. Until the users screen exists (#22), a STAFF user is created by script: see `docs/staff-user-production.md`. A STAFF member recovers the password at `/recuperar`: the code goes to the business WhatsApp and the owner shares it.
- Auth: email+password or Google OAuth
- `conektaCustomerId` for recurring payments
- `appointments` → 1:N relation with booked appointments

### Product
- Tenant-scoped
- `itemType` (`ItemType`) → `PHYSICAL`, `SERVICE`, `PACKAGE`, `SUBSCRIPTION`
- `durationMinutes` → estimated duration in minutes for appointments/consultations (default: 30)
- `requiresBooking` → boolean. Together with `Tenant.isBookingEnabled` it forms the `isBookable` rule (`src/lib/bookable.ts`): only bookable items have a date and time; the rest are information only (price and description).
- `capacity` → maximum capacity for group services or tours
- `visitModes` (`ServiceModes`, nullable) → how this service is delivered: `IN_PERSON`, `ONLINE` or `BOTH`. `null` follows the business setting `Tenant.serviceModes`. The business setting is only the default; the service setting overrides it, so no combination is invalid (`effectiveModes`, `modalityModeFor`, `resolveModality` in `src/lib/patient-intake.ts`, tests in `tests/service-modality.test.ts`). With a single mode nobody is asked, but the customer is told (bot before confirming, web read-only line, product page badge); with `BOTH` the customer chooses. `bot/context` returns `modalityMode` and `modalities` per product, `bot/availability` returns `modalityMode`, and `bot/book` and `POST /api/appointments` answer `modality_not_available` when the asked mode is not one the service offers. Set in the product form (bookable services). `prisma/sql/23-product-visit-modes` applied to the real database on 2026-11-10; pending: the n8n chat prompt must use the per-service `modalityMode` (see `.claude/plans/service-modality.plan.md`).
- `priceMode` (`PriceMode`: `FIXED`, `FROM`, `ON_REQUEST`; default `FIXED`) → a price can be exact, a starting price ("From $X") or defined after the assessment (stored as `price = 0`, never shown). `assessmentProductId` (nullable) → for an `ON_REQUEST` item, the service to book to learn the price (a priced, bookable, visible service of the same business). An item with a valid target is not booked itself (`requiresBooking` is forced to false on save); the product page offers "Book <target>", and with no target an on-request item offers "Ask about the price" on WhatsApp. The target is checked on save and again on read (`resolveAssessmentTarget`, `loadAssessmentTargets`), so a deleted, hidden or changed target silently stops redirecting. One module decides everything: `src/lib/price-display.ts` (`priceView`, `isPurchasable`, `storeAction`, `normalizePriceInput`, `sortByPrice`) and, for text sent to machines, `src/lib/price-text.ts` (`priceFieldsFor`: `price` is null on request, `priceText` is the sentence to use, in the business `messageLanguage`). Money paths: `api/checkout` and `api/orders` answer `price_not_fixed` for any item that is not a fixed price above zero. A free service is a fixed price of 0 typed on purpose (shown as "Gratis"; the new-service form starts with an empty price and an empty price is refused with `priceRequired`, so nothing becomes free by accident; physical items cannot be free). `bot/context` returns `priceMode`, `priceText`, `price` (null on request) and `bookInstead` per service; `bot/book` on an on-request service answers `not_bookable` with the service to offer. `prisma/sql/25-product-price-mode` applied to the real database on 2026-11-10 after a verified pg_dump backup (5 products, all FIXED afterwards); pending: the n8n chat prompt and the social campaign workflow must be checked before deploy (a `null` price could print as the word "null"). Plan: `.claude/plans/price-by-diagnosis.plan.md`; recording the final price per visit (`Appointment.finalPrice`) is phase 2.
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
- `customerEmail` → email the customer typed when booking (may differ from the linked account's email). Optional: without it no calendar invitation is sent.
- `customerAge` → patient age (0 to 120) asked on the first booking and copied forward from the latest visit. `null` in older visits.
- `modality` (`AppointmentModality`: `IN_PERSON`, `ONLINE`) → how the visit happens; `null` in older visits. `meetUrl` → video link of an online visit when the calendar created one.
- `referredByKey`, `referredByName` → recommended by: when a visit is booked for someone else (`patientPhone`), the booker's patientKey and name at that moment are saved (`referralOf` in `src/lib/patient-intake.ts`). Null for visits booked for oneself. Shown in `/admin/citas` ("Recomendado por …") and in the patient history (from the patient's oldest visit that has it).
- `externalProvider` (`AppProvider`) and `externalEventId` → calendar (`GOOGLE` or `MICROSOFT`) and id of the event that mirrors the appointment; `null` if no calendar is connected
- `googleEventId` → legacy, replaced by `externalEventId`; removed after running `local-utils/backfill-appointment-calendar-links.mjs`
- `reminderSentAt`, `customerConfirmedAt`, `autoReleasedAt` → reminder sent, confirmed by the customer, and released without confirmation. Rescheduling the appointment resets them. `remindersSent` is legacy.
- `reminderAttempts`, `reminderLastError`, `reminderLastAttemptAt` → failed reminder sends: number of failed attempts, a short reason and the time of the last one. A successful send or a reschedule clears them (`src/lib/reminder-state.ts`). The reason is stored through `safeFailureReason`, so it never carries a provider name or a raw response body (white-label rule); the full detail goes only to the server log. These fields are not sent to the browser: `GET /api/appointments` drops `reminderLastError` (`omitReminderError`).

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
- **Token refresh** (`getAppToken` in `src/lib/connected-apps.ts`, decision in `src/lib/oauth-refresh.ts`): the connection is deleted **only** when the provider says the permission is gone (`invalid_grant`, `interaction_required`, `consent_required`, `login_required`, with HTTP 400 or 401). A rate limit, a 5xx, a wrong client setting on our side, a network error or a timeout keep the connection and return `null` for that call. The refresh call times out after 8 s, and a connection that failed temporarily rests for 60 s (in memory, per server instance) before the next attempt. Before this rule any error deleted the connection, which silently disconnected the calendar and left mirrored events impossible to delete.
- Google Calendar uses the account's **primary** calendar: that account's real events count as busy time and appear in `/admin/citas`. The connection requests more scopes than the calendar needs (`gmail.send`, `spreadsheets.readonly`); trimming them is pending. If the Google app is in "Testing" mode in Google Cloud, the refresh token expires after 7 days and the connection is lost again.

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
- Mexico prices (Spanish landing, `PricingSection.tsx`, `pricing.mx` in i18n): Start $499, Plus $899, Pro $1,499 MXN per month; one-time net setup fee $2,500, $5,500 and $9,500; monthly only. Checkout still has two plans (Start uses STARTER; Plus and Pro use PRO) and prices come from Stripe (`/api/billing/prices`; Plus uses the new variable `STRIPE_PRICE_PLUS_MONTHLY`, with $499, $899 and $1,499 as fallback if any is missing). United States prices: estimated in Stripe, see `docs/analisis-costos-y-precios-eeuu.md`.
- Plans (`PlanId`): STARTER (Start), PLUS (Plus), PRO (Pro), ENTERPRISE. CLINICA, VETERINARY and TOURISM still exist in the enum but nothing uses them (retirement pending).
- **PLUS status:** the value is in the production database (`prisma/sql/17-plan-plus`) and the code that understands it shipped with PR #49; the tenant `elfar` runs on PLUS. (Before that code was live, setting a tenant to PLUS broke its CRM once on doctorg.)
- **Plan copy (2026-11-05):** Facebook/Instagram campaigns belong to **Pro** (registry, landing and `due` route agree); Google Calendar appointments are open to Start. The checkout cards (`billing.startFeatures`, `plusFeatures`, `proFeatures` in i18n) list only what is built, taken from the landing lists (`pricing.mx`); the landing lists stay as published. Prices always come from Stripe. The landing shows Start, Plus and Pro in every language (USD for English, no setup fee or US quotas defined yet; Plus US fallback $49, env `STRIPE_PRICE_PLUS_MONTHLY_DLLS`). The old `pricing.starterFeatures` and `proFeatures` copy is unused.
- **Which tools each plan includes:** `src/lib/capabilities.ts` (registry, `enforcedPlan`). Locked tools are hidden from the sidebar, shown in the App Store with a legend, and blocked on the server (pages redirect to `/admin/suscripcion`, APIs answer 403 `plan_required`). Guards: `src/lib/capability-guard.ts`. Tests: `tests/capabilities.test.ts`, `tests/plan-guard.test.ts`.
- Statuses: TRIALING, ACTIVE, PAST_DUE, CANCELED, UNPAID
- Billing managed by Stripe
- `trialEndsAt` → trial period expiration date (14 days from creation)
- Helpers in `src/lib/trial.ts`: `getTrialDaysLeft()`, `isTenantOnTrial()`, `isTrialExpired()`, `isSubscriptionBlocked()`
- `TrialBanner` → shown during the trial; `TrialExpiredGate` → blocks the CRM on expiry

---

## AI Token Credits System (Platform AI Metering)

Each tenant has a monthly AI credit spending budget ($15 USD for Start, $25 for Plus, $50 for Pro).

### 1. Plan limits
| Plan | Monthly credit |
|---|---|
| **STARTER** | **$15.00 USD** (default) |
| **PLUS** | **$25.00 USD** |
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

> **Decision of Oct. 29, 2026 (privacy):** customer data (WhatsApp bot, Newy AI) goes to paid models, primary `google/gemini-2.5-flash`. Free models are kept only for content without personal data (social campaigns). Every OpenRouter request sends `provider: { data_collection: "deny" }` (`providerPreferences()` in `src/lib/ai/openrouter.ts`); `OPENROUTER_REQUIRE_ZDR=true` adds zero retention. In the OpenRouter account, also turn on the exclusion of providers that train on data (it covers n8n). The real cost per model is in `MODEL_PRICES_PER_M` (`src/lib/credits.ts`). See `docs/analisis-modelos-gratuitos.md`.

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
`src/middleware.ts` runs only on `/admin` and `/admin/:path*`:

| Condition | Action |
|---|---|
| `/admin/*` + no session, or a role outside the CRM | Redirect to `/login` |
| `/admin/*` + STAFF on a section it cannot open | Redirect to `/admin`, which sends it to its first section (or an empty screen if it has none) |

Not active (they were in the root `middleware.ts`, which never ran; separate ticket): root domain + tenant route to 404, `/checkout` or `/pedido/*` without login to `/login`, and `/login` or `/registro` with a session to the home page. After a credentials sign-in, the login page sends each role to its home (`src/lib/home-after-sign-in.ts`).

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
- **Agent**: n8n Agent v2.2 with OpenRouter (paid models: primary `google/gemini-2.5-flash`, fallback `openai/gpt-4o-mini`; n8n credential), Postgres memory `whatsapp_bot_memory` (12-message window, key `instance:phone`) and 5 tools.
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
- **Greeting and introduction**: a pure greeting ("hola", "buenas tardes") is answered by the server with a template, without calling the agent or spending credits (`src/lib/greeting.ts`, `greetingReply` of `POST /api/internal/bot/context`). Every pure greeting gets the introduction ("Hola, soy el asistente de WhatsApp de [negocio]"), also inside an active chat. For any other first message the agent introduces itself if nobody wrote to the contact in the last 12 hours (`introRequired`), received as PRESENTACION in the prompt. The greeting is stored as a bot message. The introduction includes the business privacy notice (`privacyUrl`, built with `tenantPublicUrl` in `src/lib/tenant-url.ts`).
- **Token reporting**: `Collect Token Usage` adds up the usage of all agent calls and `Report Token Usage` sends it to `POST /api/internal/tokens/report`, which charges the tenant at the retail rate. If the provider does not report usage, it is estimated (2,000 prompt tokens per call plus response length / 4).
- **Credits exhausted**: the "Guard: Credits OK" node checks `creditExhausted` (from `POST /api/internal/bot/context`) before reaching the agent. If the tenant already exhausted its monthly limit, the model call is skipped and a fixed degradation reply is sent.
- **Total cascade failure**: the "Bot Agent" node has `onError: continueErrorOutput`; if every model fails, that branch sends the customer a fixed apology reply (instead of silence) and calls `POST /api/internal/bot/alert-failure` to notify the owner (60-min cooldown, see §"Tenant owner alerts" in the credits section).
- **Calendar for the agent**: `POST /api/internal/bot/context` returns `calendarText` (next 14 days with weekday, date and hours, generated by `upcomingCalendarText()` in `src/lib/business-hours.ts`). The prompt uses it to name days and dates; the model must not compute weekdays on its own.
- **Hours offered**: `POST /api/internal/bot/availability` returns at most 3 free hours (`availableSlots`, `hasMore`); `after` (HH:mm) returns the next ones. The agent never lists the whole day or every day.
- **Patient intake and modality** (`src/lib/patient-intake.ts`, pure rules with tests in `tests/patient-intake.test.ts`): a number is a known patient when it already has an appointment in the business (latest visit by `patientKey`, `getKnownPatient` in `src/lib/patients.ts`). `bot/context` returns `patient`, `intake` and `modalityMode` (`IN_PERSON`, `ONLINE` or `ASK`), so the first booking asks name, age and an optional email and later bookings ask nothing about the patient. `bot/book` with the body field `intake: "v2"` enforces it: a new patient without name or age gets `patient_info_required`, a business set to both modes without the choice gets `modality_required`, a typed email must be valid and no email is fine (no calendar invitation is sent). Without `intake: "v2"` (a workflow not yet re-imported) the route keeps the old rule: name and a valid email required (`email_required`), no age or modality. A patient without email gets a stable placeholder login `<patientKey>@wa.guest.local` (`guestEmailFor`), never shown or mailed (`isSyntheticEmail`). A registered patient is shown the stored name, age and email (`bot/context` returns `patient.email`, null when none) and asked once to confirm them before booking. When the customer books for someone else, the bot collects that person's name, age, WhatsApp number and optional email and sends `patientPhone` to `bot/book`; `resolveBookingPhone` saves the visit under that number (`invalid_patient_phone` when it is not a phone; the sender's own number in another format counts as the sender), so the history, the reminders and the SI confirmation go to that person. If the sender is a known patient and the agent sends another first name without `patientPhone` (only the first word is compared, ignoring case, accents and a leading title such as Dr., Dra., Sr., Sra., Lic. or Ing., so a surname change is not caught), `bot/book` answers `patient_phone_required` and creates nothing (`isOtherPersonsName`, ticket #72: the agent can drop the other person's number in a long chat, and the visit used to be saved under the sender's number). The agent then asks for that person's WhatsApp, or books without `customerName` to keep the registered name; a nickname of the registered first name also gets that question. A number already hit by the bug has the other person's name as its latest visit, so its owner gets the question for their own name, and booking without `customerName` keeps the wrong name: fix those visits in production before or together with deploying this check. `bot/book` answers `patientName`, `forOtherPerson` and `recipientPhone` (the number the reminder goes to, last four digits, `maskPhone`). The visit remembers who booked it (`referredByKey`/`referredByName`, an automatic recommendation), and the booker sees it in `my-appointments` (`forOtherPerson`, `patientName`) and can cancel or reschedule it from their chat (`visitsOfSender` matches the visit's own phone or the booker's key). A visit booked for another person adds a line to its reminder and to the owner confirmation saying who booked it (first name) and to reply if it was not requested (`withBookedBy` in `src/lib/reminder-messages.ts`); the booker name comes from the registry or from `senderName` (WhatsApp profile name) in the `bot/book` body. Canceling and rescheduling do not ask for a name or email: they are identified by the WhatsApp number and `list_my_appointments`.
- **Online visits and calendar events**: the event gets a Google Meet link only for `ONLINE` visits (and for older callers with no modality); `IN_PERSON` events get the business address as location and no video link. The link is stored in `Appointment.meetUrl` and returned by `bot/book` and `bot/my-appointments`. It is also added as a last line ("Videollamada: <link>", `withMeetingLink` in `src/lib/reminder-messages.ts`) to the reminder, the reply after the patient confirms with SI, the owner's confirmation from the Confirmaciones tab and the Confirmar button in `/admin/citas`; only `https://` links of online visits are added, so it reaches patients who gave no email too. Decision (2026-11-06): for now the meeting link is always created with Google Meet through the connected Google calendar. A business with Outlook, or with no calendar, gets no automatic link: the bot tells the patient the clinic will send it. Own-link setting and Teams are postponed.
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
- **Where to go in the reminder**: an in-person visit (and a visit from before `modality` existed) gets `Ubicación: <address> (<directions link>)` after the visit details, built from the tenant's address with `locationTextForBot`; an online visit gets its `https://` Meet link (`Videollamada: ...`) instead. The request to reply SI stays last. Nothing is added when the business has no physical location or the online visit has no link. Helpers `withLocation`, `withMeetingLink` and `placeText` in `src/lib/reminder-messages.ts`; the order is built in `reminderText` (`src/lib/reminder-run.ts`).
- **Tenant texts**: the tenant writes data with bracketed tags: `[Servicio]`, `[Fecha]`, `[Hora]`, `[Hora límite]`, `[Nombre del negocio]`, `[Nombre]`, `[Ubicación]` (service, date, time, deadline time, business name, customer's first name, place). `[Ubicación]` (`[Location]`) is the address with directions link for an in-person visit and the Meet link for an online one; it is valid in the reminder and confirmation texts only (the cancellation text rejects it: `validateNoLocationTag`, `template_location_not_allowed`), the card offers its button only there, and a text that uses it is not given the automatic place line a second time (`hasLocationTag`). With nothing to show it renders empty and the gap is closed, so a sentence built around it ("Te esperamos en [Ubicación].") reads poorly for a business without an address. `[Nombre]` is valid in all three texts; when the visit has no customer name the tag is removed and the gap closed ("Hola [Nombre], te" becomes "Hola, te"). The rules live in `src/lib/reminder-template-rules.ts` (no server code): the settings card runs them while the owner types, marks the field and the offending fragment in red and disables Save until every text is valid; the server runs them again on save. Stored texts are re-checked at send time and fall back to the language default if invalid (`usableTemplate`). The tags are taken from the i18n dictionaries (`crm.business.token*`) and the server accepts those of any language. Never show braces or technical names to the tenant or the customer. Texts are validated on save (`PATCH /api/tenants/reminders`, rules in `src/lib/reminder-messages.ts`), because any bracketed word that is not filled in reaches the customer exactly as typed:
  - Every bracketed word must be one of the seven tags (`validateKnownTags`, error `template_unknown_tag`). Tags ignore case and spaces inside the brackets, and accept the labels of any language.
  - `[Hora límite]` only exists for the confirmation text, so the reminder and cancellation texts reject it (`validateNoDeadlineTag`, `template_deadline_not_allowed`). A reminder can go out with no deadline at all. The card offers the "Deadline time" button only in the confirmation field.
  - The confirmation text must include the deadline tag and an explicit instruction to reply with a confirming word (`validateConfirmationTemplate`). Any word in `REPLY_WORDS` counts (`si`, `yes`, `ok`, `okay`, `confirmo`), and every one of them is read as a yes by the bot (`isClearConfirmation`; a test keeps both lists in step). The word counts right after a verb such as responde, escribe, contesta, manda (reply, type, send), also as "responde con un SI"; `SI` or `YES` in capitals count alone, `OK` never does. Accents are ignored like the bot does, so `Sí` counts. The Spanish conditional "Si no la confirmas…" does not count by itself. The confirmation field has an "Agregar petición de confirmación" button that adds the request ("Responde SI para confirmar tu cita." / "Reply YES to confirm your appointment.") as its own paragraph, also offered inside the error. The reminder text must not ask for any of those words.
  - `renderTemplate` drops the final period of a value (`a.m.`, `p.m.`) when the template closes the sentence with another period right after the tag.
- **Default customer texts**: `customerMessages` in `src/i18n/es.ts` and `en.ts` (reminder, confirmation, footer without confirmation, cancellation, confirmation reply). Dates and times with `clinicLongDate` and `clinicTime` according to `messageLanguage`.
- **Rules** (`src/lib/reminders.ts`, pure functions): the notice goes out `reminderLeadMinutes` before the appointment, at the exact time (also at night); the release is `appointment time − confirmationDeadlineMinutes`. The window to reply (notice to release) must be at least 30 minutes. If the appointment was booked after the notice time, the notice goes out at booking (if the window allows). If the window is smaller, or confirmation is off: a late-booked appointment receives nothing (counts as confirmed); otherwise, only a simple reminder. No phone: no message and it is never released.
- **Structure**: the route only loads the visits and wires the real I/O. The per-visit decisions are in `src/lib/reminder-run.ts` (`runReminderBatch`, I/O injected so it is testable without a database or WhatsApp), the real I/O in `src/lib/reminder-data.ts` (`loadReminderVisits`, `realReminderDeps`), and what is written after a send, a failure or a reschedule in `src/lib/reminder-state.ts`.
- **Failures are not silent**: one visit that throws never stops the others. A failed send stores the attempt on the visit (`reminderAttempts`, `reminderLastError`, `reminderLastAttemptAt`) and is listed in the response `failures`. If every attempted send failed (`sent = 0` and `failed > 0`, not in `dryRun`), the route answers **502** so n8n shows the run as an error without editing the workflow (n8n marks any 2xx as success); a partial failure stays 200. There is no hard retry cap: a failed send costs nothing and is retried every run until the appointment starts. The owner is not alerted through WhatsApp for this, because that is the channel that may be down; the signal is the CRM badge and the n8n run status.
- **CRM badge**: `/admin/citas` shows "Recordatorio no entregado" (`t.agenda.reminderNotDelivered`) on an active (`PENDING` or `CONFIRMED`) native appointment that has failed attempts, no `reminderSentAt`, and a future date (`reminderNotDelivered` in `src/lib/reminder-badge.ts`). It shows only the attempt count, never the technical reason.
- **Sending** (`reminders/run`): sends once per appointment (`Appointment.reminderSentAt`). If sending fails, it neither marks nor charges; it is retried on the next run. Each successful send charges `REMINDER_COST_USD` (default `0.0085`) with `recordMessageCharge()`: it adds to `totalCostUsd`, increments `AiTokenLedger.reminderCount` and records `REMINDER_PROVIDER_COST_USD` (default `0`) as the real cost. Reminders go out even without credits and may exceed the limit; the owner is notified only once per period.
- **Release**: if confirmation was requested, `reminderSentAt` exists, there is no `customerConfirmedAt` and the deadline has passed, `releaseVisit()` (`src/lib/reminder-actions.ts`) calls `cancelAppointment` (status `CANCELLED`, deletes the Google/Outlook event, frees the slot) and sends the cancellation text. `autoReleasedAt` is set.
- **Customer confirmation**: `POST /api/internal/bot/confirm` (`x-internal-key`). Replies `sí`/`confirmo`/`de acuerdo`… (yes/I confirm/agreed) count only if the reply is short and contains no negations, changes or questions (`isClearConfirmation`). If it confirms: `customerConfirmedAt`, status `CONFIRMED` and a confirmation reply. If it is not a confirmation: `handled: false` and the message continues to the agent. The chat flow calls this endpoint before the agent ("Check Confirmation" node); the agent has the `confirm_appointment` tool as a backup.
- **Owner list** ("Confirmaciones" tab in `/admin/whatsapp`): `GET /api/apps/whatsapp/confirmations`, and `POST /api/apps/whatsapp/confirmations/[id]` with `action: "confirm" | "release"`. "Liberar ahora" (release now) uses the same `releaseVisit`. Both use one filter, `AWAITING_CONFIRMATION` (`src/lib/reminders.ts`): active visit, reminder sent, no `customerConfirmedAt`, not released.
- **Confirmed means `customerConfirmedAt`**: the SI reply, the Confirmations tab and the "Confirmar" button in `/admin/citas` all set it (the button only changed the status before 2026-11-06, so the job still released the visit and the customer got "CONFIRMADA" and then the cancellation). The job never decides on the status, because the bot creates its bookings `CONFIRMED` before the customer answers. A visit confirmed before its reminder gets the plain reminder, without the request to reply SI.
- **Channel**: `sendWhatsAppMessage` (Evolution). With Meta's official API, a reminder outside the 24 h window will need an approved template.
- **Testing the flow in minutes**: `local-utils/reminder-sim.ts` runs the real job (same code as production) on one test visit named `PRUEBA #16` with a simulated clock, because the settings cannot go below 60 min before the visit and a 30 min answer window. Modes: `fail` (send forced to fail, no WhatsApp), `send` (real WhatsApp, charges the tenant), `release` (cancels, deletes the calendar event, real cancellation text). Without `--yes` it only prints. Usage: `npx tsx --env-file=.env local-utils/reminder-sim.ts --id <appointmentId> --mode fail|send|release [--yes]`. It writes to the real database and sends real messages, so use it with your own number and ask first.
- **Status (ticket #16)**: tested end to end with real WhatsApp and Google Calendar (reminder, confirmation with SI, release, event created and deleted). **Pending**: deploy the code, verify in production (eligible visits get their message, the 502 shows in n8n, the event is deleted with the real clock), and test a custom cancellation text and the English language in a real send. The chat workflow `n8n-chat-workflow-v2.json` and the reminders workflow are already re-imported (checked read-only on 2026-11-08).

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
OPENROUTER_REQUIRE_ZDR=          # true requires zero-retention endpoints (can leave a model without an endpoint)
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
# Only read by the /n8n command (read-only inspection of the n8n instance), never by the app:
N8N_API_URL=                     # https://<your-n8n-host>/api/v1  (no trailing slash)
N8N_API_KEY=                     # n8n > Settings > n8n API. Without Enterprise it has full access: treat it as a secret

# ─── Internal APIs (n8n → Next.js) ──────────────────────────────────────────────
# IMPORTANT: All endpoints under /api/internal/ verify this header: x-internal-key
INTERNAL_API_KEY=                # openssl rand -hex 32
# Note: in .env.example it may appear as INTERNAL_API_SECRET — they must be the same value

# ─── WhatsApp Evolution API ─────────────────────────────────────────────────────
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
PLATFORM_WA_INSTANCE=            # NewAigent's own instance: account messages such as the password reset code (src/lib/platform-whatsapp.ts). Without it no code is sent and /recuperar still answers ok

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
npm run db:push          # Apply the schema to the DB without a migration. NOT safe against the real database today (see "Schema changes")
npm run db:seed          # Create sample data
npm run db:studio        # Open Prisma Studio (DB UI)
vercel --prod            # Deploy to production

npx tsx --test tests/*.test.ts     # Automated tests (node:test, no database needed)
npx tsc --noEmit                         # Type check
npx tsx --env-file=.env local-utils/<script>.ts   # Scripts that touch the database: tsx does NOT load .env by itself
```

> ⚠️ **`npm run build` and `npm run dev` share the `.next` folder.** Running a build while the dev server is up breaks the dev server (CSS and chunks answer 404). Stop the dev server, or restart it with `rm -rf .next && npm run dev` afterwards. OAuth for Google and Facebook only works on port 3000 locally (the redirect URI is fixed to `http://localhost:3000`); Google also refuses to sign in from a browser driven by automation, so connect the calendar from your normal browser.

### Schema changes (manual SQL, up and down)

`npm run db:push` compares the **whole** `schema.prisma` with the real database and applies every difference. The real database has a table Prisma does not know: `whatsapp_bot_memory` (the WhatsApp agent's conversation memory in n8n). `db:push` would **drop it** and the bot would lose its memory. The project has no migration history yet (`prisma migrate` adoption is a separate task), so a schema change goes as a folder in `prisma/sql/<change>/` with:
- `up.sql`: additive when possible (new nullable columns or columns with a default), so the old code keeps working until the new code is deployed.
- `down.sql`: the exact reverse. Written by hand (Prisma does not generate it). It deletes the data held in what it removes, so it runs only to undo the change and after the code that reads it is gone.

How to make one safely:
1. Add the fields to `schema.prisma` and write both files.
2. Verify on a throwaway local PostgreSQL (same major version as production): load the schema-only dump, then compare with `DIFF_URL=<url> npx prisma migrate diff --config local-utils/prisma-diff.config.ts --from-config-datasource --to-schema prisma/schema.prisma --script` before `up.sql` (only your change shows), after `up.sql` (nothing about your change) and after `down.sql` (your change shows again). The only expected leftover is the `whatsapp_bot_memory` drop.
3. Take a verified backup first (`pg_dump` of the same major version, custom format, stored **outside the repo** with owner-only permissions; it holds personal data), and a fresh one right before applying. `pg_dump` refuses a server newer than itself.
4. Get explicit human approval, then apply `up.sql` in one transaction (`psql -v ON_ERROR_STOP=1 -1 -f up.sql`) and verify types, defaults and that existing rows did not change.
5. **Order: database first, code after.** New code reads the new columns; if it ships first, every appointment query fails (reminders, agenda, bot, CRM). Old code ignores extra columns, so the reverse is safe. Merging to `main` deploys through CI/CD, so a merge counts as a deploy.

Done so far: `prisma/sql/19-staff-role/` (`STAFF` value in `UserRole`, ticket #21): tested on the local mirror only, **NOT applied to production**. Apply it (backup, approval) **before** merging the code that uses it: the password reset lookup sends `'STAFF'` to the database and fails for every owner without the value. Its `down.sql` refuses to run while a STAFF user exists. `prisma/sql/22-referred-by/` (`referredByKey`, `referredByName` and an index on appointments), applied to the real database on 2026-11-06 after a verified `pg_dump` backup; additive. `prisma/sql/21-patient-intake/` (age, modality and meeting link on appointments, `Tenant.serviceModes`), applied to the real database on 2026-11-06 after a verified `pg_dump` backup (kept outside the repo); verified types, defaults and that the 32 existing appointments did not change. The throwaway-database `migrate diff` check was not run (no test database). The code that reads it is not deployed yet. `prisma/sql/16-reminder-attempts/` (ticket #16). `prisma/sql/17-plan-plus/` (PLUS value in `PlanId`), applied to production on 2026-11-05 after a verified backup; the code that uses it shipped with PR #49. There is no separate test database yet: local development uses the real one, so treat every local write as a production write.

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
- **Schema in sync**: verified on 2026-11-02 with a read-only `prisma migrate diff`: `botEnabled`, `botPausedReason` and `businessHours` are already applied. The only difference between `schema.prisma` and the database is `whatsapp_bot_memory` (declare it in the schema or exclude it before anyone runs `db:push`).
- **No test database**: local development and production share one database. A separate mirror database for tests, periodic backups and `prisma migrate` adoption are pending tasks.
- **Web appointments from before the time fix**: they were saved with UTC time (6 hours ahead). Fix with `local-utils/shift-web-appointments-utc-fix.mjs` (first without `--write`) and manually move the calendar events that get listed.
- **Hardcoded secrets in n8n workflows** (internal key, Evolution API key, OpenRouter key in the social campaign). Move to credentials when n8n allows it, and rotate them.
- **Social workflow**: if a publication fails after the text was generated, its tokens are not reported.
- **Pets**: the `pets` table and `appointments.petId` exist in the database, but tests with real data are pending: the database queried on Oct. 26 was empty. `local-utils/check-pets.ts` still needs to be run with a real tenant.
- **Reminders**: tested end to end locally; deploy and production verification are pending (see "Appointment Reminders and Confirmation").
- **Calendar sync fails silently**: if the connected calendar errors when booking, the appointment is saved only in the database, with no event and no notice.
- **Reminder job race**: if saving `reminderSentAt` fails after a successful send, the next run sends again; there is no lock between overlapping runs. If `releaseVisit` fails after cancelling, the customer never gets the cancellation text.
- **Password reset hardening** (security review 2026-11-06; pre-existing since PR #55, and since ticket #21 it also covers STAFF accounts): the 5-attempt cap can be bypassed with parallel `/confirm` requests (the counter is read, then incremented, and the rate limit is per server instance), so make the attempt count and the code consumption atomic; `/confirm` answers "expired" or "attempts used" only for existing accounts, which reveals them; `/request` takes longer when the account exists (it waits for the WhatsApp send). Minor: a session survives a password change (role and session live 30 days in the JWT), anyone who knows an email can spam the business WhatsApp with codes, and a pending code survives a password change made another way.
- **JWT role is never re-read**: the role lives 30 days in the token, so a deleted or changed user keeps its access until the token expires (seen on the local mirror on 2026-11-06). Blocks #22 (deactivating users).
- **Confirm message from Citas**: the WhatsApp text sent by the "Confirmar" button in `/admin/citas` is hardcoded in Spanish, with health wording ("por el especialista") and emojis, for every vertical, and ignores `messageLanguage`. Use the same `ownerConfirmedText` as the Confirmations tab.
- Row Level Security in Supabase (currently only app-level filtering)
- Rate limiting on `/api/chat`
- Trial expiry gate: `TrialBanner` and `TrialExpiredGate` exist, but the trial expiry gate in the admin layout still does not fully block all routes

### Plans, tools and billing: pending (as of 2026-11-05)
Built on branch `feat/plan-plus-tools`, not committed or deployed. Database changes applied to production: `prisma/sql/17-plan-plus` (PLUS value) and `prisma/sql/18-enabled-tools` (`tenants.enabledTools`), each after a verified backup.

Do not set a business to PLUS until the code that understands PLUS is live.

- **Deploy the plan work.** Commit and open a pull request, then merge (merging deploys). Then run a browser check on a real login: sidebar, App Store cards, activation, locked pages, the 403 responses, and the checkout in MXN and USD.
- **Live Stripe prices.** The Plus prices in `.env` are test-mode prices. Production (Vercel) needs live-mode IDs for `STRIPE_PRICE_PLUS_MONTHLY` (MXN, $899) and `STRIPE_PRICE_PLUS_MONTHLY_DLLS` (USD, $49), plus the matching live Start and Pro prices.
- **Mexico Start price.** The Stripe price for Start in MXN reads $500, but the published price is $499. Confirm which one is right.
- **"View plans" upgrade path (later phase).** Locked tools show "Contact Newy team" as a plain label for now. Add a billing link or contact channel once the owner decides how plan changes happen.
- **Plus candidates.** The US analysis (`docs/analisis-costos-y-precios-eeuu.md`) compares $39, $49 and $59. $49 was chosen; the 600-conversation Plus quota is an assumption to confirm.
- **Plus annual.** Not offered. Mexico is monthly only, and Plus is monthly only in the US too.
- **Patient history at Plus.** Not built: decision D4 puts full patient history at Pro. A basic visit list at Plus would be a new tool.
- **WhatsApp confirmations.** Locked at Plus (tab and both APIs) and listed as a line in the WhatsApp card. The in-page lock is covered by tests on the API and guard wiring, not on screen.
- **n8n endpoints.** `due` skips tenants below Pro. `context` and `webhooks/social-campaign` are not plan-checked (see the note on the n8n workflow before changing them: a 403 would stop the workflow, and the webhook also carries the AI credit charge).
- **Social Campaigns activation.** It uses its Meta connection, not the owner activation step. Decide whether it should have one too.
- **Owner activation for existing Pro businesses.** A business that moves to Pro starts with no tools turned on, so the owner must activate Patient history and Patients in the App Store. Tell existing Pro customers before the release.
- **Retire old plan values.** CLINICA, VETERINARY and TOURISM are still in the `PlanId` enum. Check the database for rows that use them, then retire them with a manual SQL change.
- **TODO tools promised by the landing, not built:** conversation counter and per-plan limits (250, 600, 1,200), handoff to authorized staff, waitlist and rescheduling, attendance statuses and reports, basic and custom conversation history, follow-up CRM, persistent multi-chat, patient reactivation and loyalty, contact import (Pro), users per plan (1, 2, 3). Build each one, add it to the capability registry, then add its line to the checkout lists.
- **TODO review request by WhatsApp.** After a visit is marked attended, send a WhatsApp message with a "leave a review" link to the business's Google reviews, in the style of a delivery confirmation message (thanks, short text, one button or link). `Tenant.placeId` already exists, so the link can be `https://search.google.com/local/writereview?placeid=<placeId>` (needs `placeId`, so only businesses with a Google Maps address). Decide the plan, the delay, the template (tenant-editable like the reminder texts) and whether it is charged like a reminder.
- **TODO signup with Plus.** The landing Plus card still starts a Pro trial because `POST /api/tenants/register` and `getStripePriceId` only know STARTER and PRO.
- **Plan phase 4 (missing tools).** Conversation counter and limits, users per plan (1, 2 and 3), waitlist, attendance reports, contact import (Pro), team roles, human handoff alert, bot safety protocols, per-product bot guidance, product priority, offers and discounts, Doctoralia integration. Each goes in the capability registry first (scope, plan, verticals, section, AI, built).
- **Plans and billing docs.** The plan file `~/.claude/plans/read-the-businnes-verticals-fluffy-breeze.md` still shows the open decisions as pending; update it when these are closed.
- **Automated tests.** The guards and the registry are covered by `tests/capabilities.test.ts`, `plan-guard.test.ts` and `billing-currency.test.ts`. There are no browser or end-to-end tests yet.
- **Database password.** The production password was pasted in chat on 2026-11-05. Rotate it in Supabase, then update `.env` and Vercel.

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
- After writing a plan, always open it with `/ecc:plan-canvas` and wait for the verdict; do not just offer it. No code until the canvas verdict is approve or the user confirms in chat.
- For browser checks with the ECC browser: save screenshots outside the repo or in a git-excluded folder (they show real names, phones and e-mails and the repo is public), and stop before submitting any form; the user submits it.

### `/n8n` command (read-only inspection of the n8n instance)
- Defined in `.claude/commands/n8n.md` with `disable-model-invocation: true`: it runs only when the user types it, never because the topic came up.
- Needs `N8N_API_URL` and `N8N_API_KEY` in `.env` (see `.env.example`). It only does `GET`: whether a workflow is active, its schedule, its last executions and what it calls. The workflows are not in the repo, so the live instance is the source of truth.
- It never prints raw workflow JSON (the workflows hold hardcoded secrets and the repo is public). Before any approved write to n8n it saves the full JSON **outside the repo** (`~/.n8n-backups/`, owner-only), and it asks with `AskUserQuestion` naming the workflow, the exact change and the backup path. Approval of a plan is not approval of the write.

### n8n MCP server (second way to reach the n8n instance)
- Besides `/n8n` (REST, `N8N_API_KEY`), the n8n instance exposes an MCP endpoint: `https://n8n.smart-flows.tech/mcp-server/http`. It is added per developer in their own Claude Code config (scope `local`, the default, which lives in `C:\Users\<user>\.claude.json`): `claude mcp add --transport http n8n-mcp https://n8n.smart-flows.tech/mcp-server/http --header "Authorization: Bearer <token>"`.
- The token is the one from n8n > Settings > MCP Access (instance-level MCP), **not** `N8N_API_KEY`. A 401 means a wrong, expired or regenerated token, or MCP Access turned off.
- **Never** put the token in the repo: not in `.mcp.json` (project scope), not in `.claude/settings.local.json`, not in `.claude/.claude.json`, not in chat. The repo is public.
- The server name is `n8n-mcp`. Check with `/mcp` (state and tool count) or `claude mcp list`. A server added or reconnected after a session started is not picked up by that session: restart the session to get its tools. A "version negotiation timed out" on first connect usually means a slow start (for an `npx` server, run it once to fill the cache, or start Claude Code with `MCP_TIMEOUT=30000`).
- Same rules as `/n8n`: reads are free; any write (import, edit, activate or deactivate a workflow) needs explicit approval in chat, with a backup of the current workflow saved outside the repo first. Never print raw workflow JSON.
- Status (2026-11-06): connected in the other sessions of the owner; the chat session had to be restarted to load it. The chat workflow `n8n-chat-workflow-v2.json` is still imported by hand until the code is deployed.

### Human gate and re-route rules
Rescued from the old `.agents/` scaffold, because ECC has no equivalent. Applies to people and to any AI assistant working on this repo.

**Stop and get explicit human approval before:**
- Deploying to production (`vercel --prod`). No exceptions, even for a hotfix.
- Applying a schema change to the database. Never with `npm run db:push` against the real database (it would drop `whatsapp_bot_memory`): use the manual `up.sql` flow in "Schema changes", with a verified backup first.
- Any write to n8n (see the `/n8n` command below), any real WhatsApp message sent as a test, and any other outward-facing action (publishing to the public issue tracker, a commit or a PR the user has not asked for).
- Any action that destructively modifies or deletes database data.
- Escalating a P1 incident (the bot or booking is down for customers).

**Also non-negotiable** (in addition to the constraints above):
- No `dangerouslySetInnerHTML` on content that came from a user, a customer or the bot.
- `npm run build` must pass with zero errors before a change is approved for review.

**Re-route rules:**

| Situation | Action |
|---|---|
| `/ecc:code-review` asks for changes | Back to implementation with the review notes as input; review again. |
| Tests find a P1 bug | Fix first; no deploy until it is re-tested. |
| `/ecc:security-scan` finds a critical issue | Block the deploy, tell the user, fix it before anything else. |
| P1 incident in production | Treat it as a new requirement (ticket in the board), and tell the user right away. |

**Fast track** (skip the plan step, keep the review):
- Typo, copy or i18n-key-only change: implement, then `/ecc:code-review`.
- CSS token tweak or docs-only change: no plan, no new tests.
- Dependency bump: `/ecc:security-scan` first.
- Hotfix: implement, review, security scan, then the human gate above.

### Architecture docs
Token-lean maps live in `docs/CODEMAPS/`: `architecture.md`, `backend.md`, `frontend.md`, `data.md`, `dependencies.md`. Read the relevant map before exploring code. Regenerate them instead of editing by hand.

### Precedence over ECC rules
When an ECC rule conflicts with this file, this file wins. In particular:
- Tenant isolation (`tenantId` from the session, never from input), `@/lib/db` for Prisma, white-label vocabulary, i18n, no emojis, minimal UI and tenant theme tokens are mandatory.
- The ECC rules for 80% coverage and TDD are the target. The repo has no coverage tool or CI test step yet, but pure logic is tested with `node:test` through `tsx` in `local-utils/*.test.ts` (`npx tsx --test tests/*.test.ts`): write the failing test first, then the code. Logic that talks to the database or the network is built with its I/O injected so it can be tested without them (see `src/lib/reminder-run.ts`). Adding a real runner and coverage is a separate task.
- The ECC "never mutate" rule applies to new code. Do not rewrite existing Prisma or Zustand code only to satisfy it.

### Known gaps (verified 2026-11-03)
- `n8n/workflows/` is cited in this file but does not exist in this checkout. Treat it as external: the live n8n instance is the source of truth (use `/n8n`). `local-utils/` now exists with tests and utilities.
- Upstash Redis is listed in the env vars but no code under `src/` uses it.

---

## Development Rules and Local Utilities

### Where tests and scripts live (`tests/` and `local-utils/`)
- **Tests** (`*.test.ts`, node:test) live in `tests/`, which is tracked and committed. Run them with `npx tsx --test tests/*.test.ts`. Pure logic goes there; I/O is injected so the tests need no database or WhatsApp.
- **Operator scripts** (checks against the database, simulators, one-off backfills, the minimal-ui audit) live in `local-utils/`. That folder is in `.gitignore` and is **never committed or pushed**. The repo is public, and these scripts reach the database or send WhatsApp messages.
- **STRICT RULE**: a utility that tests something, diagnoses the database, simulates API calls, or is not part of the production app goes in one of these two folders. Never in the project root (`./`), in untracked temporary folders such as `scratch/`, or in `src/`.
- Before any commit, PR or push, run `git diff --cached --name-only` and `git diff origin/main...HEAD --name-only`. Neither may list an added or modified path under `local-utils/`. A deletion (`D`) is allowed only when it untracks a file that used to be in git (how the legacy scripts leave the index). If an added or modified path appears, unstage it (`git restore --staged <file>`) and say so before committing.
- Never use `git add -f` on a `local-utils/` file. Never stage with `git add -A` or `git add .`: stage files by name.
- Status (2026-11-06): the test suites moved to `tests/`; the operator scripts are no longer tracked. Both changes are staged and not yet committed.

### No emojis in the UI
- **NEVER** use emoji characters (`📋`, `✅`, `⚠️`, `⭐`, `🚀`, etc.) as UI elements in JSX/TSX.
- All icons must come from `lucide-react`. Always specify the component name, size (`size`) and `strokeWidth` when relevant.
  - Correct: `<AlertTriangle size={16} className="text-amber-500" />`
  - Incorrect: `⚠️ Warning`
- Icon-only buttons must include `aria-label` for accessibility.

### Minimalist style on tenant screens
- Tenant screens (CRM, storefront, login/signup) follow a flat, neutral style, like Claude or ChatGPT. The rules are in `local-utils/minimal-ui/config.js` (auto token swaps and flagged patterns); check with `node local-utils/minimal-ui/audit.js` (read-only).
- No gradients, blur, colored shadows, hover scaling or uppercase labels. The tenant's colors and font are kept.
- To audit or rewrite styles use the `minimal-ui` skill (scripts in `local-utils/minimal-ui/`).
- The dark NewAigent brand pages (landing, legal, billing, 404) are not covered by this style.
- **Run both checks before writing any tenant UI, and again before closing it:**
  - `node local-utils/minimal-ui/audit.js`: decorative style (radius, shadows, uppercase, gradients).
  - `node local-utils/minimal-ui/theme-colors.js`: hardcoded colors. **FAIL** = a brand-like palette color (`green-600`, `emerald-50`, `blue-600`, ...) or a hex value on a tenant screen; exit code 1. **WARN** = red status colors (errors), reviewed by hand. Neutrals (gray, slate, zinc, white, black) are allowed. SVG brand marks are ignored.
  - Both are read-only. Report the output for the files you touched: each FAIL is fixed or justified, each WARN is reviewed.
  - Existing screens have FAILs from before these checks (for example status badges on `(public)/mis-pedidos` and `admin/negocio`). The rule applies to every new or changed line; clean up the old ones when you touch those files.

### Follow the tenant's style (theme in the database)
- **Text on a primary fill**: never `text-white` on `bg-primary`. Use `text-[color:var(--on-primary)]`: `--on-primary` is set with the rest of the theme (`themeColorVars` and `readableTextOn` in `src/lib/theme-vars.ts`, tests in `tests/theme-vars.test.ts`) and picks white or near-black, whichever contrasts more, so it stays readable on very light and very dark tenant colors. Shared pieces: `src/components/ui/FilterChip.tsx` (filter pills) and `src/components/ui/RadioOption.tsx` (radio rows, 44px tall on phones). `scrollbar-slim` (globals.css) gives a chip row a thin scrollbar in the tenant's primary color. Not yet swept: about 29 older `bg-primary ... text-white` uses in apps, pacientes, pedidos, productos, reviews, social-campaign, whatsapp, Pagination, ChatAssistant, CalendarView, Navbar and ProductCard.
- Every new page or component of the **public storefront** (`(public)/`) and the **CRM** (`admin/`) must respect the tenant's visual theme stored in the `ThemeConfig` table (`primaryColor`, `secondaryColor`, `accentColor`, `fontFamily`).
- The theme is injected as CSS variables from the tenant layout. Always use `var(--color-primary)` / `bg-primary` / `text-primary` and the configured Tailwind utilities — **never** hardcoded color values (`#16a34a`, `green-600`, etc.) in tenant components.
- In **marketing page** components (`marketing/`), fixed colors are allowed because they do not belong to any tenant.
- If a new component needs an accent color different from the tenant's, it must expose it as a prop or CSS token — not hardcode it.
- The color check is `node local-utils/minimal-ui/theme-colors.js` (see "Minimalist style on tenant screens"). A UI change is not done until it has no new FAIL.
- Before closing any UI change, check and state the result: empty value, long value, dark mode, very light and very dark tenant colors (the white text on `bg-primary` must stay readable), and another vertical when it applies.

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
- **Legal texts**: `src/components/legal/legalContent.ts` (Spanish and English; platform and each business). The business version receives its public data (`LegalSubject`: name, owner, address if there is a physical location, WhatsApp, and whether it handles health data). Do not put prices, plan limits or absolute guarantees in the text; point to the pricing page. Who operates NewAigent (legal name, address, privacy e-mail, retention period, jurisdiction) lives in `src/lib/legal-entity.ts` and is **empty**: an empty field is left out of the text. Fill it in and ask a lawyer to review before publishing. Check: `npx tsx local-utils/check-legal-content.ts`.
- **Notice when capturing data**: the booking flow (`BookingFlow`) asks for a checkbox with a link to `/privacidad` (and consent for health data at health businesses). The bot introduction includes the link to the notice.

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
- **No duplicate grids**: The separate FullCalendar view at the bottom of the page was removed to avoid numeric discrepancies and ensure all appointments share the same list and KPI metrics (`TOTAL`, `POR CONFIRMAR` (to confirm), `CONFIRMADAS` (confirmed), `COMPLETADAS` (completed)). The page opens on today's appointments; the date chips (Hoy, a picked day, Todas las fechas) and the status chips are two labeled rows. The KPI cards and the status chip counts follow the chosen day (the whole month when no day is chosen) and ignore the status and search filters (`GET /api/appointments`); the calendar dots always cover the month.
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
