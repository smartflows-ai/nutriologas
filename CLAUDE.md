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
    (legal)/            ← Own group, no storefront navbar or footer (LegalPageLayout draws its own header)
      terminos/         ← Terms of Service — Spanish
      privacidad/       ← Privacy Policy — Spanish
      terms/            ← Terms of Service — English locale alias
      privacy/          ← Privacy Policy — English locale alias
    (auth)/
      login/            ← Login with email/password + Google OAuth
      registro/         ← New customer signup (with legal consent)
      cambiar-contrasena/ ← A CRM user chooses their own password; the only screen a user with a temporary password can open
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
      equipo/           ← Team: the owner creates, resets, deactivates and activates staff users (ADMIN only)
      pacientes/        ← Patient/triage profiles (visible only if Tenant.isTriageEnabled = true)
      suscripcion/      ← Tenant Stripe subscription management
    api/
      appointments/     ← GET/POST tenant appointments (isolated by tenantId)
      appointments/[id] ← PATCH status, clinical notes and panel edits (service, time, patient details; never the phone); DELETE is a soft delete (ticket #103)
      appointments/[id]/restore ← POST: bring back a deleted visit (before its start time, never on top of another visit)
      appointments/services ← GET: bookable services for the "Nueva cita" form (no price)
      appointments/known-patient ← GET: name, age and email of a phone's latest visit, to prefill the form (rate limited)
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
      admin/users       ← GET/POST the business staff users; `[id]` PATCH reset_password | deactivate | activate (permission `users.manage`, ADMIN only)
      auth/password-change ← POST: a signed-in CRM user changes their own password (the only API open to a temporary password)
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
- `helpEscalationMinutes` (default 15, 15 to 240 in steps of 15) → minutes an assistant has to take a WhatsApp chat that needs a person before the owner is told (see "Chats that need a person"). Set in the "Ayuda humana" card of `/admin/whatsapp` > Configuracion (`GET/PATCH /api/tenants/help`).
- `remindersEnabled` → enables WhatsApp appointment reminders (default: true)
- `reminderLeadMinutes`, `confirmationRequired`, `confirmationDeadlineMinutes`, `reminderTemplate`, `confirmationTemplate`, `cancellationTemplate`, `messageLanguage` → reminder and confirmation settings (see "Appointment Reminders and Confirmation"). `reminderMode` and `reminderSendTime` are legacy.
- `reminderOffsetsMinutes` → legacy: no longer used (replaced by `reminderLeadMinutes`)
- `timeZone` (IANA name, default `America/Mexico_City`) and `timeZoneSource` (`default`, `google` or `manual`) → the business time zone (ticket #111, `prisma/sql/29-tenant-time-zone`, applied to production; confirmed read-only on 2026-11-18). See "Business time zone".
- `businessHours` → weekly opening hours (JSON, a list of `{start, end}` blocks per day; empty list = closed; several blocks per day = lunch break). Edited by the admin in `/admin/negocio`. Null in the field = default hours (Monday to Saturday 09:00 to 18:00). Read by the web, the storefront homepage ("Opening hours" row, shown when booking is on or the vertical is service-first) and the bot through `src/lib/business-hours.ts`. Start times (`daySlots`) step by the service duration and a session must end before its block closes. Pending: `npm run db:push`.
- `ownerName`, `hasPhysicalLocation`, `address`, `placeId`, `latitude`, `longitude` → owner or person in charge and business location (address chosen with Google Maps). The address only exists with `hasPhysicalLocation = true`; turning it off clears it. Captured at signup and in `/admin/negocio`, shown on the store homepage, and the WhatsApp bot receives them in `bot/context` (`ownerName`, `locationText`). Helpers in `src/lib/location.ts` (`locationSchema`, `directionsUrl`, `locationTextForBot`).

### User
- Belongs to a single tenant
- `role`: `CUSTOMER` | `ADMIN` | `STAFF`
- `STAFF` (ticket #21) is a team member, shown as "Asistente" in health, "Guía" in tourism and travel, "Personal" elsewhere (`staffTitle` in `src/lib/vertical-profile.ts`). It opens only Citas, WhatsApp and Historial (Historial still needs its plan and owner activation), never receives clinical notes (`internalNotes`, visit notes, notes counts), cannot delete chats, and sees no billing or credits. Since ticket #103 it creates, edits, deletes (soft) and restores visits in Citas, but never books or reschedules outside business hours or on top of another visit (`appointments.overbook` is owner only, enforced by the server). One permission map, `src/lib/permissions.ts`, is read by the middleware, pages, sidebar, client hooks and APIs; API guard `requirePermission` in `src/lib/permission-guard.ts`. Tests: `tests/permissions.test.ts`, `tests/staff-title.test.ts`. The owner manages staff from `/admin/equipo` (ticket #22, see "Team: staff users"). A STAFF member recovers the password at `/recuperar`: the code goes to the business WhatsApp and the owner shares it.
- `isActive` (default `true`) → `false` blocks sign-in and cuts an open session on its next request. `mustChangePassword` (default `false`) → `true` after the owner creates the user or resets the password; only `/cambiar-contrasena` opens until the user chooses a password. `sessionVersion` (default `0`) → goes up on an owner reset, a deactivation and a WhatsApp reset; a session only works for the version it was issued for (`prisma/sql/23-user-access`).
- `whatsappNumber` (optional, STAFF) → where the notice "a chat needs help" is sent. Set by the owner in `/admin/equipo` (`PATCH /api/admin/users/[id]` with `action: "set_whatsapp"`); stored as `+` and digits; never the business line or the owner's number (`src/lib/staff-whatsapp.ts`).
- Auth: email+password or Google OAuth
- `conektaCustomerId` for recurring payments
- `appointments` → 1:N relation with booked appointments

### Product
- Tenant-scoped
- `itemType` (`ItemType`) → `PHYSICAL`, `SERVICE`, `PACKAGE`, `SUBSCRIPTION`
- `durationMinutes` → estimated duration in minutes for appointments/consultations (default: 30)
- `requiresBooking` → boolean. Together with `Tenant.isBookingEnabled` it forms the `isBookable` rule (`src/lib/bookable.ts`): only bookable items have a date and time; the rest are information only (price and description).
- `capacity` → maximum capacity for group services or tours
- `visitModes` (`ServiceModes`, nullable) → how this service is delivered: `IN_PERSON`, `ONLINE` or `BOTH`. `null` follows the business setting `Tenant.serviceModes`. The business setting is only the default; the service setting overrides it, so no combination is invalid (`effectiveModes`, `modalityModeFor`, `resolveModality` in `src/lib/patient-intake.ts`, tests in `tests/service-modality.test.ts`). With a single mode nobody is asked, but the customer is told (bot before confirming, web read-only line, product page badge); with `BOTH` the customer chooses. `bot/context` returns `modalityMode` and `modalities` per product, `bot/availability` returns `modalityMode`, and `bot/book` and `POST /api/appointments` answer `modality_not_available` when the asked mode is not one the service offers. Set in the product form (bookable services). `prisma/sql/24-product-visit-modes` applied to the real database on 2026-11-10; pending: the n8n chat prompt must use the per-service `modalityMode` (see `.claude/plans/service-modality.plan.md`).
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
- `deletedAt`, `deletedById` → soft delete (ticket #103, `prisma/sql/27-appointment-soft-delete`). A deleted visit is hidden from every read (agenda, busy times, reminders, bot, confirmations, history, KPIs, Newy AI, short links) and frees its slot; the app never erases a visit. **Every appointment query filters `deletedAt: null`**; `tests/appointments-soft-delete-guard.test.ts` fails on a new query without it (an intended exception carries the comment `// soft-delete: includes deleted (<why>)`). Each delete and restore writes a row to `AppointmentTrail` (`appointment_trail`: action `DELETED`/`RESTORED`, user, role, time), shown in the "Eliminadas" tab. The clinical note of a deleted visit stays in the patient history under "Notas de visitas eliminadas" (`splitVisitNotes`).

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
- Google Calendar uses the account's **primary** calendar by default; with `calendar.calendarlist.readonly` every calendar of the account counts as busy time. The connection asks for `calendar.events`, `calendar.calendarlist.readonly`, `gmail.send` (the confirmation e-mail of `POST /api/internal/calendar/create-event`), `userinfo.email` and `userinfo.profile`; all are sensitive scopes (Google's Gmail page lists `gmail.send` as sensitive, not restricted). `spreadsheets.readonly` is not requested (no code uses Sheets). Accounts connected before a scope change keep their old permissions until they connect again.

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

## Team: staff users (`/admin/equipo`, ticket #22)

The owner creates, resets, deactivates and activates the staff of the business without the technical team.

- **Screen**: `/admin/equipo` (ADMIN only; server gate `requireAdminPage`, sidebar entry "Equipo", capability `team` on every plan). Components in `src/components/admin/team/`; data and actions in the `useTeam` hook (one action at a time, so a double click cannot reset a password twice).
- **APIs**: `GET/POST /api/admin/users` and `PATCH /api/admin/users/[id]` with `action`: `reset_password`, `deactivate` or `activate`. Guard: permission `users.manage` (`src/lib/permissions.ts`), never granted to STAFF. The business and the actor come from the session only.
- **Rules** (`src/lib/staff-users.ts`, pure, tests in `tests/staff-users.test.ts`; database in `src/lib/staff-users-data.ts`): the screen only acts on STAFF users of the caller's business. The owner's own account, another owner, a customer and a user of another business all answer 404 `user_not_found`. An email already used in the business, with any role, answers 409 `email_already_registered`; the account is never converted. Emails are stored trimmed and in lowercase, as sign-in looks them up.
- **User limit by plan** (`src/lib/user-limits.ts`): Start 1, Plus 2, Pro 3 active CRM users, the owner included, as the landing publishes. Start has no room for staff. A deactivated user does not use a seat; activating checks the limit again. Over the limit: 409 `user_limit_reached`. The count and the write run in one transaction that first locks the business row (`FOR NO KEY UPDATE`), so two requests at once cannot pass the limit. A business that moves to a smaller plan keeps its users and cannot add more.
- **Temporary password** (`src/lib/temp-password.ts`): 14 random characters without look-alikes, created by the server, stored only as a bcrypt hash (cost 12, `src/lib/password-hash.ts`), returned once in the response (`Cache-Control: no-store`) and shown once in `TempPasswordDialog`. Never logged, never kept in browser storage. The owner hands it over outside the system. It does not expire by time.
- **First sign-in**: the user lands on `/cambiar-contrasena` and can open nothing else. `POST /api/auth/password-change` asks for the current (temporary) password and the new one twice, with the shared rules (`passwordIssues`); the new one must differ from the temporary one. The rule lives in `src/lib/password-change.ts` and is shared with the owner's password card (`PATCH /api/tenants/account/password`).
- **Reset**: every open session of that user ends on its next request (`sessionVersion` goes up), the old password stops working, and the next sign-in with the new temporary password forces a change again. **Deactivate**: the user loses access on the next request, cannot sign in (credentials or Google) and gets no `/recuperar` code; activating does not revive the old sessions.
- **`/recuperar`** keeps working for active staff: a successful reset turns `mustChangePassword` off, because the user chose the password and the owner shared the code, and ends every earlier session of that account.
- **Role name** by vertical (`staffTitle`): Asistente, Guía or Personal.
- **Production**: `prisma/sql/23-user-access` is applied (confirmed read-only on 2026-11-18). Steps in `docs/staff-user-production.md`.
- Tests: `tests/staff-users.test.ts`, `staff-users-data.test.ts`, `user-limits.test.ts`, `temp-password.test.ts`, `password-change.test.ts`, `account-state.test.ts`, `sign-in-check.test.ts`, `team-api-wiring.test.ts`, `team-ui-wiring.test.ts`.

---

## Dynamic Theming and Custom Typography

The system respects the colors and typography configured by each business in `/admin/apariencia` (`ThemeConfig`):
- **CSS variables**: Injected in `:root` as `--color-primary`, `--color-secondary`, `--color-accent` and `--font-family-base`.
- **Google Fonts**: Pre-loaded in `src/app/layout.tsx` (`Inter`, `Montserrat`, `Playfair Display`, `Roboto`, `Space Grotesk`).
- **Tailwind**: Configured with `colors.primary = "var(--color-primary)"` and `fontFamily.sans = ["var(--font-family-base)", ...]`.
- **Link previews (ticket #116)**: on a business subdomain, `generateMetadata` in `src/app/layout.tsx` describes the page with `tenantPreview` (`src/lib/tenant-metadata.ts`, tests `tests/tenant-metadata.test.ts`): title = business name, description = the start of `businessInfo` (else "Bienvenido a <name>"), `og:image` = the logo, else the first active carousel image or service photo (a hosted image is served as a jpg of at most 600 px), `og:url` = the business address, `og:locale` = `es_MX` or `en_US`. Everything follows `Tenant.messageLanguage`, never the request: the WhatsApp preview reader sends no Spanish `accept-language`, so the old text came out as "Welcome to …". The business 404 page uses the same language (`getBusinessTranslationServer` in `src/lib/tenant-language.ts`). `<html lang>` still follows the browser, like the UI. The root domain keeps the NewAigent metadata. WhatsApp caches previews: test a new one with `?v=2`.
- **Portaled modals and drawers**: Any component that uses `createPortal(..., document.body)` (such as `CreditsDrawer`) must explicitly declare `style={{ fontFamily: "var(--font-family-base), system-ui, sans-serif" }}` so it does not lose the tenant's custom typography when escaping the layout.

---

## Authentication and Authorization

### NextAuth v4
- Providers: `Credentials` (email+password) and `Google`
- The JWT includes custom fields: `id`, `role`, `tenantId`
- The middleware validates the token in the Edge Runtime with `getToken()`

### Middleware redirect flows:
**Live account check (ticket #22):** the token only proves who the user is. On every authenticated request the account row is read (`readAccountAccess` in `src/lib/account-state-data.ts`, rules in `src/lib/account-state.ts`) from the NextAuth `jwt` callback and from `getSessionAccess` / `getAppSession` (`src/lib/session.ts`):
- Deleted or `isActive = false`: no access. Pages go to `/login`, APIs answer 401.
- `sessionVersion` different from the one in the token: no access, for good. The owner reset the password or deactivated the account after that sign-in, so a stolen cookie does not come back when the user chooses a new password or the account is activated again; the user signs in again. A token from before versions existed counts as `0`, so the release signs nobody out.
- `mustChangePassword = true`: pages go to `/cambiar-contrasena`, APIs answer 401; only `POST /api/auth/password-change` and sign-out work.
- Otherwise the role comes from the database, not from the token.

For those two locked cases the session object has **no `user`** (`sessionForAccess`), so every route's `!session?.user` guard rejects it. Always guard with `session?.user`, never with `!session` alone: Prisma ignores a filter whose value is `undefined`, so a route that went on with a missing `tenantId` would read every business. A database error fails closed (no access for that request). Cost: one primary-key read per authenticated request, no cache.

`src/middleware.ts` cannot read the database, so it still trusts the token; the real gate for pages is `requireCrmSession` (admin layout and `requireAdminPage`, `src/lib/permission-guard.ts`). Next.js does not run the layout again on client navigation, so `SessionWatch` (`src/components/admin/SessionWatch.tsx`) asks for the session on every section change and sends a locked user out. Known limits: a user who stays on one screen is only stopped at their next click or API call, and a user demoted from ADMIN to STAFF can still load the empty shell of an owner page (its APIs answer 401); no screen changes roles today.

Sign-in: credentials go through `passwordMatches` (`src/lib/sign-in-check.ts`), which always runs one bcrypt comparison, so an unknown email, a deactivated account and a wrong password answer the same in the same time. Google sign-in is refused for STAFF and for deactivated accounts (`googleSignInAllowed`).

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
- **Agent**: n8n Agent v2.2 with OpenRouter (paid models: primary `google/gemini-2.5-flash`, fallback `openai/gpt-4o-mini`; n8n credential), Postgres memory `whatsapp_bot_memory` (16-message window, key `instance:phone`) and 5 tools.
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
- **Chats that need a person (HITL)** (`prisma/sql/28-help-requests`, applied to production on 2026-11-18 after a verified `pg_dump` backup kept outside the repo; row counts unchanged, `migrate diff` empty afterwards): `WhatsAppChat` carries `helpReason`, `helpPriority` (0 none, 1 medium, 2 high, 3 critical), `helpRequestedAt`, `assignedToId` (the assistant in charge), `helpAssigneeNotifiedAt`, `helpOwnerNotifiedAt` and `helpTakenAt`. The reasons and their priority live in one registry, `src/lib/help-reasons.ts` (wants to buy, asks for a person, reply not delivered, agent failed, no reply for 10 minutes, credits used up, online visit without a link; `tool_loop`, `reminder_failed` and `urgency` are off in version 1). `POST /api/internal/bot/help` (any reason, `reason` required) and `bot/handoff` (purchase by default) find the contact's chat, pause the bot when the reason needs a person (`pausesBot`: `botPausedReason` takes the reason) and raise the request (`src/lib/help-handler.ts`, `help-requests.ts`, `help-state.ts`, `help-routing.ts`; tests `tests/help-*.test.ts`). Who is told: the chat's assigned assistant; else a queue (active STAFF with a WhatsApp number, fewest open chats, then the longest without a notice); else the owner at once. If nobody takes the chat within `Tenant.helpEscalationMinutes` the owner is told; this check and the "no reply for 10 minutes" detection run at the end of `reminders/run` (every 15 minutes, inside their own try/catch, so the reminder status never changes). Reasons that hit the whole business (`send_failed`, `agent_failed`, `credits_exhausted`) notify once per hour. Answering from the panel or the phone, marking handled, or turning the bot back on closes the request (marking handled also turns the bot back on when the hand-off paused it; a person writing into that pause changes its reason to `owner_reply`, and the owner's own manual pause is never lifted); **Tomar** puts the person in charge, stops the escalation and pauses the bot if it was answering (`botPausedReason: "taken"`, lifted by marking handled). Only the owner assigns chats (`POST .../help` with `assign`; it stamps `helpAssignedAt`). The assignee gets an in-app notice at once (`AssignmentToaster`, mounted once in `src/app/admin/layout.tsx`, polls `GET /api/apps/whatsapp/help-count`, shows once per assignment, remembers what it showed in `localStorage` only) and, if nobody takes the chat 15 minutes later, a WhatsApp notice from the same 15-minute job (`remindAssignees` in `src/lib/help-requests.ts`, rule `assignmentReminderDue` in `src/lib/help-routing.ts`). An assignee who cannot receive WhatsApp is never replaced in silence: the owner is told (`owner_unreachable` notice) and the chat stays with that assistant. The sidebar counter shows the chats in charge of an assistant (`mine`) and the whole business for the owner. Deactivating a staff user releases their chats (`staff-users-data.ts`). The chat list is ordered by `compareChatsForViewer` (`src/lib/chat-order.ts`). The notice (`src/lib/help-notice.ts`) names the reason and links the chat; it never carries the customer's message. `bot/contact-status` answers `botEnabled: false` for the owner's and staff numbers (`src/lib/team-numbers.ts`), so an assistant replying to a notice is never answered by the bot. The chats screen shows a color bar, icon and reason per chat (red high, amber medium), a "Necesitan ayuda" filter, a band with the actions in the open chat and a counter in the sidebar (`GET /api/apps/whatsapp/help-count`). n8n tool `request_human_help` (reason `purchase_intent` or `person_requested`) and the nodes `Mark Help: Send Failed`, `Agent Failed` and `Credits Exhausted` call these routes; the workflow file is not in git.
- **Catalog kinds and availability queries**: `bot/context` returns `kind` per item (`CITA` bookable, `INFORMACION` described only, `PRODUCTO` physical item: the customer is told the team follows up on WhatsApp and the tool hands the chat over). `bot/availability` also accepts `time` (HH:mm, one exact hour: `requested.status` is `free`, `taken` or `outside_hours`, with the 3 nearest free hours) and `edge` (`first` or `last` free hour); `after` stays exclusive, and the answer carries `weekday` (`src/lib/slot-query.ts`, tests `tests/slot-query.test.ts`). Empty strings count as not sent.
- **Business rules**: prices may be quoted, never changed or discounted. Appointments within the business's weekly hours (`Tenant.businessHours`, `src/lib/business-hours.ts`, Mexico time), with per-service duration. Only `isBookable` items are scheduled. Conflict checking covers native appointments and the connected calendar (Google or Outlook, `getBusyPeriods` in `src/lib/calendar-sync.ts`); if the calendar fails, only the database is used. The web and the bot create appointments with the same service (`src/lib/appointments-service.ts`).
- **Patient times**: they are the business's own time (`Tenant.timeZone`, see "Business time zone"). They are built with `clinicDateTime(date, time, zone)` and read with `clinicTimeOf(date, zone)` (`src/lib/clinic-time.ts`). Never use a `Z` suffix or a fixed offset for a time chosen by the patient.
- **Privacy**: the system prompt forbids mentioning technical formats, IDs, tools, errors, infrastructure and other customers' data. It is a guide for the model, not a guarantee. The `Clean Reply` node removes repeated greetings and is the only output filter.
- **Greeting and introduction**: a pure greeting ("hola", "buenas tardes") is answered by the server with a template, without calling the agent or spending credits (`src/lib/greeting.ts`, `greetingReply` of `POST /api/internal/bot/context`). Every pure greeting gets the introduction ("Hola, soy el asistente de WhatsApp de [negocio]"), also inside an active chat. For any other first message the agent introduces itself if nobody wrote to the contact in the last 12 hours (`introRequired`), received as PRESENTACION in the prompt. The greeting is stored as a bot message. The introduction includes the business privacy notice (`privacyUrl`, built with `tenantPublicUrl` in `src/lib/tenant-url.ts`).
- **Token reporting**: `Collect Token Usage` adds up the usage of all agent calls and `Report Token Usage` sends it to `POST /api/internal/tokens/report`, which charges the tenant at the retail rate. If the provider does not report usage, it is estimated (2,000 prompt tokens per call plus response length / 4).
- **Credits exhausted**: the "Guard: Credits OK" node checks `creditExhausted` (from `POST /api/internal/bot/context`) before reaching the agent. If the tenant already exhausted its monthly limit, the model call is skipped and a fixed degradation reply is sent.
- **Total cascade failure**: the "Bot Agent" node has `onError: continueErrorOutput`; if every model fails, that branch sends the customer a fixed apology reply (instead of silence) and calls `POST /api/internal/bot/alert-failure` to notify the owner (60-min cooldown, see §"Tenant owner alerts" in the credits section).
- **Calendar for the agent**: `POST /api/internal/bot/context` returns `calendarText` (next 14 days with weekday, date and hours, generated by `upcomingCalendarText()` in `src/lib/business-hours.ts`). The prompt uses it to name days and dates; the model must not compute weekdays on its own.
- **Visit times and place in bot answers (ticket #111)**: `bot/my-appointments` (each visit) and `bot/reschedule` (the moved visit) describe a visit with `botVisitView` (`src/lib/bot-visit-view.ts`, pure, tests in `tests/bot-visit-view.test.ts`): `startsAt` with the business offset of that day (`2026-11-17T19:30:00-06:00`, it was UTC before), `date`, `time` ("07:30 p.m."), `weekday` ("martes"), `timeZone`, `timeZoneLabel` ("hora de Ciudad de México"), `modality`, `meetLink` (online only: short link, or the real one without a code) and `location` (not online only). `bot/book` adds `weekday`, `timeZone` and `timeZoneLabel`; `bot/cancel` returns only the time fields (`botVisitTime`); `bot/availability` returns `timezone` as `"<IANA> (UTC<offset>)"` plus `timeZone` and `timeZoneLabel`; `bot/context` returns `timeZone` and `timeZoneLabel`. The time text has one source, `clinicTimeLabel` in `src/lib/clinic-time.ts` (`formatSlotTime` calls it); its 12 or 24 hour format is decided in #114. `tests/bot-visit-routes-wiring.test.ts` fails if a bot route sends `appointmentDate.toISOString()`. Part 3 of #111 (WhatsApp send failure, n8n) shipped with #117 and #118.
- **Hours offered**: `POST /api/internal/bot/availability` returns at most 3 free hours (`availableSlots`, `hasMore`); `after` (HH:mm) returns the next ones. The agent never lists the whole day or every day.
- **Full name on every visit (ticket #113)**: a new visit needs a first name and a surname in the panel, `/agendar` (`POST /api/appointments`) and `bot/book`; anything else answers `full_name_required` and creates nothing. One pure rule, `isPlausibleFullName` (`src/lib/full-name.ts`, tests `tests/full-name.test.ts`): at least two name words; titles (Dra., Mtra., Lic.), particles (de la, Jr.) and initials (Ma., J.) are allowed but not counted; keyboard mash, a repeated letter, the same word twice and filler (desconocido, paciente, cliente, ok) are refused. The forms check it before sending. In `bot/book` the error message tells the agent what to ask, so no n8n change was needed: a registered patient whose stored name is one word is asked for the surname on the next booking. A stored filler name (`isFillerName`, e.g. "Paciente") is not compared by the #72 check below, so that patient can give their real name. Editing an older visit without changing its name does not ask for a surname. Pet names do not follow this rule.
- **Patient intake and modality** (`src/lib/patient-intake.ts`, pure rules with tests in `tests/patient-intake.test.ts`): a number is a known patient when it already has an appointment in the business (latest visit by `patientKey`, `getKnownPatient` in `src/lib/patients.ts`). `bot/context` returns `patient`, `intake` and `modalityMode` (`IN_PERSON`, `ONLINE` or `ASK`), so the first booking asks name, age and an optional email and later bookings ask nothing about the patient. `bot/book` with the body field `intake: "v2"` enforces it: a new patient without name or age gets `patient_info_required`, a business set to both modes without the choice gets `modality_required`, a typed email must be valid and no email is fine (no calendar invitation is sent). Without `intake: "v2"` (a workflow not yet re-imported) the route keeps the old rule: name and a valid email required (`email_required`), no age or modality. A patient without email gets a stable placeholder login `<patientKey>@wa.guest.local` (`guestEmailFor`), never shown or mailed (`isSyntheticEmail`). A registered patient is shown the stored name, age and email (`bot/context` returns `patient.email`, null when none) and asked once to confirm them before booking. When the customer books for someone else, the bot collects that person's name, age, WhatsApp number and optional email and sends `patientPhone` to `bot/book`; `resolveBookingPhone` saves the visit under that number (`invalid_patient_phone` when it is not a phone; the sender's own number in another format counts as the sender), so the history, the reminders and the SI confirmation go to that person. If the sender is a known patient and the agent sends another first name without `patientPhone` (only the first word is compared, ignoring case, accents and a leading title such as Dr., Dra., Sr., Sra., Lic. or Ing., so a surname change is not caught), `bot/book` answers `patient_phone_required` and creates nothing (`isOtherPersonsName`, ticket #72: the agent can drop the other person's number in a long chat, and the visit used to be saved under the sender's number). The agent then asks for that person's WhatsApp, or books without `customerName` to keep the registered name; a nickname of the registered first name also gets that question. A number already hit by the bug has the other person's name as its latest visit, so its owner gets the question for their own name, and booking without `customerName` keeps the wrong name: fix those visits in production before or together with deploying this check. `bot/book` answers `patientName`, `forOtherPerson` and `recipientPhone` (the number the reminder goes to, last four digits, `maskPhone`). The visit remembers who booked it (`referredByKey`/`referredByName`, an automatic recommendation), and the booker sees it in `my-appointments` (`forOtherPerson`, `patientName`) and can cancel or reschedule it from their chat (`visitsOfSender` matches the visit's own phone or the booker's key). A visit booked for another person adds a line to its reminder and to the owner confirmation saying who booked it (first name) and to reply if it was not requested (`withBookedBy` in `src/lib/reminder-messages.ts`); the booker name comes from the registry or from `senderName` (WhatsApp profile name) in the `bot/book` body. Canceling and rescheduling do not ask for a name or email: they are identified by the WhatsApp number and `list_my_appointments`.
- **Online visits and calendar events**: the event gets a Google Meet link only for `ONLINE` visits (and for older callers with no modality); `IN_PERSON` events get the business address as location and no video link. The link is stored in `Appointment.meetUrl` and returned by `bot/book` and `bot/my-appointments`. It is also added as a last line ("Videollamada: <link>", `withMeetingLink` in `src/lib/reminder-messages.ts`) to the reminder, the reply after the patient confirms with SI, the owner's confirmation from the Confirmaciones tab and the Confirmar button in `/admin/citas`; only `https://` links of online visits are added, so it reaches patients who gave no email too. Decision (2026-11-06): for now the meeting link is always created with Google Meet through the connected Google calendar. A business with Outlook, or with no calendar, gets no automatic link: the bot tells the patient the clinic will send it. Own-link setting and Teams are postponed.
- **Tools with errors as data**: the agent's five tools have `neverError`; a 409 response (`slot_unavailable`) reaches the model as a message and the customer gets a normal reply. Since ticket #103 that message names the nearest free times and `alternatives` lists them (`botSlotTakenBody` in `src/lib/free-slots.ts`), so the agent offers other times in the same reply instead of a bare "not available".
- **Past times**: no appointments are created at times that have already passed (`POST /api/appointments` answers `date_in_past`, for all creators; the bot and web availability also filter them).
- **n8n rules for this flow**:
  - In Code nodes and tools use `$('Node').first().json`, not `$('Node').item`. With `.item` it fails with "No data found from `main` input" and the tool sends an empty instance.
  - `$env` is not available in this n8n instance. Secrets go inside the workflow.
  - Do not enable "Require Specific Output Format" or connect an Output Parser to the agent. The free model does not follow that schema.

---

## Business time zone (`Tenant.timeZone`, ticket #111)

Every business has its own time zone (IANA name). Instants are stored in UTC; the zone is used only when a wall-clock time comes in or goes out.
- **R1.** Stored times are UTC instants (`appointmentDate`); only reading and writing a wall-clock time uses the zone.
- **R2.** One zone per business, used by everything of that business: weekly hours, free times, reminders, the bot, the calendar events, the panel, `/agendar` and `/mis-citas`. The admin agenda (`GET /api/appointments`) groups visits by the business day, not the UTC day (before, a 19:30 visit in Mexico City showed on the next day).
- **R3.** One module converts: `src/lib/clinic-time.ts` (`clinicDateTime`, `clinicIsoOf`, `clinicDateKeyOf`, `clinicTimeOf`, `clinicTimeLabel`, `clinicWeekdayOf`, `clinicOffsetOf`, `isRealClinicTime`, `isValidTimeZone`, `DEFAULT_TIME_ZONE`), and every function receives the zone. Daylight saving time is handled: a skipped hour is never offered (`isRealClinicTime`), a repeated hour uses its first instant. `tests/time-zone-guard.test.ts` fails if `America/Mexico_City` or `-06:00` appears in any other file under `src/` (the zone list `src/lib/time-zones.ts` is the other allowed file).
- **R4.** The zone comes from the address: picking a place (`AddressSearch`) returns its zone from `POST /api/places/details` (`timeZone`, null when Google cannot tell), and `/admin/negocio` and the signup modal propose it at once in their "Zona horaria" list (signup starts from the WhatsApp country code). On save the server asks Google again; a sent zone equal to Google's answer stays `google`, any other one is `manual`. Saving coordinates in `/admin/negocio` or at signup asks Google's Time Zone API (`src/lib/time-zone-lookup.ts`, server only, 5 s timeout, network injected for tests). The owner can always pick another zone in the same card (list in `src/lib/time-zones.ts`: Mexico, United States, Latin American capitals and Madrid; a detected zone outside the list is kept and shown as an extra option). A zone picked by hand sticks (`timeZoneSource = manual`) and a new address no longer replaces it. A failed lookup never blocks the save and never changes the zone. Without an address, signup suggests a zone from the WhatsApp country code (`suggestTimeZoneForPhone`). Rules: `src/lib/time-zone-choice.ts` (`chooseTimeZone`, `shouldDetectTimeZone`). Invalid zone in the API: 400 `time_zone_invalid`.
- **R5.** Every bot answer with a time carries `timeZone` and `timeZoneLabel` ("hora de Cancún" / "Cancun time", `timeZoneLabel` in `src/lib/time-zones.ts`; the labels of `Intl` are not used because they read "hora estándar oriental"). The business texts name the zone only with the tag `[Zona horaria]` / `[Time zone]`, valid in the reminder, confirmation and cancellation texts. `/agendar` and `/mis-citas` name the zone next to the times. Showing each patient their own zone is phase 2.
- **Server code with only the tenant id** reads the zone with `getTenantTimeZone(tenantId)` (`src/lib/tenant-time-zone.ts`, one primary-key read; `usableTimeZone` falls back to the default for a bad stored value). **Client screens** read it with `useBusinessTimeZone()` (`src/components/shared/BusinessTimeZone.tsx`), filled by the admin and storefront layouts.
- Tests: `tests/clinic-time.test.ts`, `time-zones.test.ts`, `time-zone-lookup.test.ts`, `time-zone-choice.test.ts`, `time-zone-tag.test.ts`, `time-zone-guard.test.ts`, `bot-visit-view.test.ts`, `bot-visit-routes-wiring.test.ts`.
- Production: `prisma/sql/29-tenant-time-zone` is applied (confirmed read-only on 2026-11-18). Allow **Time Zone API** on `GOOGLE_MAPS_API_KEY` (see "Business Profile"). The key must be a server key: Google refuses Time Zone API calls from a key with website (referer) restrictions (`REQUEST_DENIED`, "API keys with referer restrictions cannot be used with this API").

## Short links on the business subdomain (`/ubicacion`, `/online/<code>`)

The customer messages carry short addresses on the business's own subdomain instead of long URLs (`src/lib/short-links.ts`):
- `<tenant>.newaigent.com/ubicacion` redirects (302) to the Google Maps directions built from the business address, place id and coordinates (`directionsUrl`). With no physical place it answers a closed page. Used by `locationTextForBot`: the bot, the reminders and the `[Ubicación]` tag. Its text is `<address>. Cómo llegar: <link>` (`Directions:` in English): the link closes the text and is never inside parentheses, because WhatsApp took a glued `)` as part of the link and that address answered 404 (ticket #116). `next.config.mjs` also redirects `/ubicacion` followed by `)`, `.`, `,`, `;`, `:`, `!`, `?` or `%29` to `/ubicacion` (tests `tests/location-text.test.ts`, run with the same matcher as Next).
- `<tenant>.newaigent.com/online/<code>` redirects (302) to the video call of ONE appointment. The code is 8 random characters, unique per business (`Appointment.meetShortCode`, migration `prisma/sql/26-meet-short-code`, nullable, applied to production 2026-11-13 after a verified backup). It is open from the start of the visit until one hour after it ends, and only while the visit is PENDING or CONFIRMED. Any other case, unknown or malformed codes included, answers the same closed page (410). Rate limited per IP.
- The customer receives the short link wherever the raw `meetUrl` used to go (`customerMeetUrl`): reminder, bot booking and my-appointments, the reply after SI, the owner's confirmation (Confirmaciones and Citas). The admin UI, the calendar event and `meetUrl` keep the real link. Google's calendar invitation to the patient's email still carries the real Meet link (cannot be changed).
- Visits booked before this change have no code and keep the real link.
- Tests: `tests/short-links.test.ts`.

## WhatsApp ban prevention (strict consent, opt-out, quiet hours, pacing)

Reduces preventable reasons WhatsApp bans a Baileys number. These are safeguards, not a guarantee — never label anything "anti-ban" or "safe". Branch `feat/whatsapp-ban-prevention` (separate from the D1 security work).

- **Three pure modules** (tests alongside): `src/lib/wa-optout.ts` (`isOptOut`, detects "baja/stop/ya no me escribas", never fires on "cancelar mi cita"), `src/lib/wa-pacing.ts` (quiet hours with midnight wrap, per-instance per-run cap of 3), `src/lib/wa-consent.ts` (`mayStartMessage`: SHADOW measures, ENFORCE blocks; opt-out blocks in both; a visit created before `messagingEnforcedAt` is grandfathered).
- **Consent sources** (`appointments.whatsappConsentAt/whatsappConsentSource`, `bookingChannel`): `WHATSAPP_BOOKING` (bot, only when the sender books for themselves — booking for another person is not consent), `WEB_CHECKBOX` (optional unchecked box on `/agendar`), `PANEL_STAFF` (staff checkbox in "Nueva cita"). Holding a phone number is never consent.
- **Reminder gate** (`src/lib/reminder-run.ts`, fed by `reminder-data.ts`): a consent-blocked visit (ENFORCE only) sends nothing and is never released, so it counts as confirmed; opt-out blocks in both modes; a night reminder is held for the morning when the visit still allows it; at most 3 sends per number per 15-min run, the rest deferred. The run response carries `blocked`, `shadowWouldBlock`, `deferred`. Default mode is SHADOW per tenant.
- **Opt-out**: `whatsapp/sync` runs `isOptOut` on inbound text, sets `whatsapp_chats.optedOutAt` and turns the bot off for that contact (`botPausedReason: "opted_out"`). A later message never re-enables it; only a new explicit consent does. Reminders and the agenda badge match the opt-out to the visit by `patientKeyOf` (`optedOutKeysOf` in `src/lib/whatsapp-permission.ts`; before 2026-11-20 the agenda compared raw digits and missed visits stored as `+52…`/`52…`).
- **Opt-out detector (QA 2026-11-20)**: it fires only on a request, never on a complaint about the past or on one item. "No me escribieron el link", "el doctor ya no me escribió", "No me manden la ubicación" and "No me envíe recordatorio" are not opt-outs; "no me escriban", "ya no me manden nada", "no me envíen más mensajes" are. Tests: `tests/wa-optout.test.ts`.
- **Opt-out in "Necesitan ayuda" (QA 2026-11-20)**: a detected opt-out also raises the help reason `opted_out` (registry `src/lib/help-reasons.ts`: medium priority, per chat, `pausesBot: false` so "Marcar atendido" keeps the bot off). The open chat shows a band ("Pidió no recibir mensajes…") with **Reactivar mensajes**: a person confirms with the patient first (browser confirm), then `POST /api/apps/whatsapp/chats/[id]/help` with `action: "reactivate"` clears `optedOutAt`, records `messagingReactivatedAt` and `messagingReactivatedById` (that record is the new explicit consent), turns the bot back on only when the opt-out paused it, and closes only the `opted_out` help request (`reactivateMessagingPatch` in `src/lib/help-actions.ts`). Turning the bot on with the switch never lifts an opt-out (`PATCH /api/apps/whatsapp/chats/[id]` answers 409 `whatsapp_chat_opted_out`). Schema: `prisma/sql/33-chat-messaging-reactivation` (two nullable columns), **applied to production on 2026-11-20** after a verified `pg_dump` backup (kept outside the repo) and an approval; tested before on a throwaway PostgreSQL 17 restored from that backup (diff before, after `up.sql`, after `down.sql`, after `up.sql` again), and `prisma migrate diff` of the real database against the schema was empty afterwards.
- **Settings** (`PATCH /api/tenants/reminders`, reminders card): quiet-hours window (`quietHoursStartMin/EndMin`, default 21:00–08:00) and `messagingPolicyMode`; switching to ENFORCE stamps `messagingEnforcedAt` (grandfathers existing visits).
- **No reminder inside the quiet hours (QA 2026-11-20)**: with the weekly hours (`Tenant.businessHours`), the reminder lead and the quiet window, every visit time maps to one reminder time (`reminderQuietConflict` in `src/lib/reminder-quiet-hours.ts`, tests `tests/reminder-quiet-hours.test.ts`). The reminders card shows "Con tu horario, una cita a las 09:00 recibiría su recordatorio a las 06:00…" and disables Save; `PATCH /api/tenants/reminders` answers 400 `reminder_in_quiet_hours`, only when the save touches the timing (so the "Mensajes al cliente" card, same route, is never blocked). `GET` returns `businessHours` for the card. On 2026-11-20 both businesses in the database (doctorgcenter, newy) already had a conflicting setup: their card opens with the error until the lead or the quiet hours change.
- **Night hold never passes the deadline (QA 2026-11-20)**: `shouldHoldForQuietHours` (`src/lib/wa-pacing.ts`) holds a night reminder only when, after the quiet window ends, at least 30 minutes remain before the confirmation deadline (or the visit when it asks no confirmation). Before, a reminder held from 22:00 went out at 08:00 saying "confirm before 08:00" and the visit was released at 08:15. The reminder job also sends with `urgent: true` (`reminder-data.ts`): the job already applied the quiet rule, and without it the messaging service held the same reminder again until the morning, after the deadline or after the visit. Regression: `tests/reminder-quiet-deadline.test.ts`.
- **Schema**: `prisma/sql/30-whatsapp-ban-prevention` (additive). **Applied to production** (confirmed read-only on 2026-11-20: every column exists, and `prisma migrate diff` of the real database against the schema of PR #130 was empty).

### Anti-ban messaging service (B0, B2, B3; merged in PR #130 on 2026-11-19)

- **One path for every outbound message.** `sendWhatsAppMessage` (`src/lib/whatsapp.ts`) calls `sendOutbound` (`src/lib/messaging/service.ts`) with the production gateway (`src/lib/messaging/gateway.ts`). The send call sites declare their purpose: `CUSTOMER_REPLY` (the owner answers a chat), `TRANSACTIONAL` (visit reminders, cancellations, confirmations) and `INTERNAL` (notices to the owner or an assistant's own number, `recipientIsTeam`). Reminders and cancellations use the idempotency keys `reminder:<visitId>` and `cancel:<visitId>`.
- **The decision** (`src/lib/messaging/policy.ts`, pure): kill switches (global, business, instance) and risk states stop every purpose; marketing is blocked; opt-out blocks transactional messages and customer replies in both modes; no consent is measured in SHADOW and blocks in ENFORCE; quiet hours defer a non-urgent visit message (held, not dropped).
- **Delivery rules** (`src/lib/messaging/delivery.ts`, pure): a SENT message is never resent; an UNKNOWN one (a timeout after the request left) is never resent blindly; a missing setup is retried later without using an attempt; a 4xx or auth failure closes the row. The text of a message is stored only until it is sent or closed. The outbox keeps only the last four digits of the recipient.
- **Circuit breaker**: an auth error or a logged-out session (401/403 on close) pauses the instance at once (`riskState = SENDING_PAUSED`, reason `possible_restriction` / `auth`). Repeated failures pause it after five in a row. Nothing resumes it by itself: `POST /api/apps/whatsapp/risk/resume` needs `confirmReviewed: true`.
- **Connection events**: Evolution's webhook now subscribes to `CONNECTION_UPDATE` (`evolution-adapter.ts`). `POST /api/internal/whatsapp/connection` (internal key) applies `src/lib/messaging/connection.ts`: an open event records the time and never clears a pause.
- **Kill switches**: the business switch is `Tenant.whatsappKillSwitch`, set with `PATCH /api/apps/whatsapp/risk` (`businessKillSwitch`). The instance switch is `connected_apps.killSwitch`. The global switch is the one row of `platform_flags` (`globalKillSwitch`), set by an operator in the database, never from the app.
- **Status card**: `src/components/admin/WhatsAppRiskCard.tsx` in the WhatsApp settings tab shows the state with an icon and a word, the reason when known, the business pause, and the resume action after a confirmation. It never shows a percentage and never calls a restriction a confirmed ban.
- **Adapter**: all calls to Evolution go through `src/lib/messaging/evolution-adapter.ts` (TLS validated, timeout 15 s, per-instance token). The insecure agents were removed (`bd1e48d`).
- **Schema**: `prisma/sql/31-whatsapp-outbox` (table `whatsapp_outbox`) and `prisma/sql/32-whatsapp-risk` (columns on `connected_apps` and `tenants`, table `platform_flags`). Both are additive and were verified up and down on the local demo database. **Applied to production** (confirmed read-only on 2026-11-20: `whatsapp_outbox`, `platform_flags`, `connected_apps.killSwitch/riskState` and `tenants.whatsappKillSwitch` exist; commit `9fb3c72` records 32 being applied).
- **Held messages**: a message held for quiet hours keeps its recipient and text (cleared when sent or closed) and is sent by `drainHeld` (`src/lib/messaging/service.ts`), called at the end of `POST /api/internal/reminders/run` (`src/lib/messaging/drain.ts`). It passes the policy, the kill switches and the breaker again.
- **Webhook secret**: on connect, the app sets the Evolution webhook with `jwt_key` = `EVOLUTION_WEBHOOK_SECRET`, so Evolution signs each call (`Authorization: Bearer <HS256 JWT>`). **The n8n side is not in place** (read-only check of 2026-11-20): neither workflow has a webhook guard or JWT Auth. Rollout steps are in `n8n/docs/cambios-n8n-2026-11-20.md` (variable in each Vercel project, re-set every existing instance's webhook, then turn on JWT Auth).
- **Platform line**: the platform sender (password codes) checks the global kill switch (`platform_flags.globalKillSwitch`). It has no outbox row, because it has no tenant.
- **Not done yet**: the bot replies still leave through the Evolution call of n8n until the workflow switches its send node to `POST /api/internal/whatsapp/send` (needs approval and an import); the per-instance key migration for existing instances (D1) needs a check of Evolution's token API before a script is written; the held-message drain has not run against a real instance yet. See also "Pending after QA 2026-11-20".
- **Cancelling from the panel (QA 2026-11-20)**: `PATCH /api/appointments/[id]` writes the status first, then removes the mirror event (`removeMirrorEvent`, `src/lib/appointments-service.ts`) and sends the patient's cancellation notice at the same time (`Promise.all`); they used to run one after the other (calendar up to 8 s, WhatsApp up to 15 s) and Cancel looked frozen. The pressed agenda button shows a spinner and "Cancelando…" (`busyStatus` on `AppointmentCard`). Wiring tests: `tests/qa-2026-11-20-wiring.test.ts`.

### WhatsApp line number and message ids (QA 2026-11-20, second round)

- **"Conectado:" with no number**: the line's number (`connected_apps.waPhoneNumber`) used to be saved only by `GET /api/apps/whatsapp/status`, which runs only while the `/admin/apps` modal waits for the QR scan, and Evolution fills `ownerJid` a moment after the connection opens; a line could stay connected with no number for good (newy did). Now `GET /api/apps/whatsapp/config` (the WhatsApp screen) asks Evolution once when the line is connected and has no number, and saves it (`needsPhoneBackfill`, `phoneFromJid` in `src/lib/whatsapp-phone.ts`); `POST /api/internal/whatsapp/connection` saves the `wuid` of an open event; the adapter also reads the nested `instance.ownerJid` shape and never falls back to another instance of the list. With no number the header says "Conectado" without the colon. Tests: `tests/whatsapp-phone.test.ts`.
- **Connection events do not reach the app**: the chat workflow has no node that calls `/api/internal/whatsapp/connection` (read-only check of 2026-11-20), so `lastConnectedAt`, the restriction pause on a 401/403 close and the `wuid` number are never written from events today.
- **Message ids unique per business**: WhatsApp gives a message the same id on both sides of a chat. When both numbers are on the platform (two businesses writing to each other, or a test phone that is itself an instance), the first business that stored it took it from the other one, because `whatsapp_messages.keyId` was unique in the whole database: the sidebar showed the last message but the chat did not. The key is now unique per business (`@@unique([tenantId, keyId])`); sync and the panel send upsert on `tenantId_keyId`. Two steps: `prisma/sql/34-message-key-per-tenant` (adds the per-business index next to the global one) is **applied to production** (2026-11-20, after a verified backup and an approval, tested on a throwaway copy); `prisma/sql/35-message-key-drop-global` (drops the global index) must be applied **only after this code is deployed**, because older code upserts with `ON CONFLICT ("keyId")`. Until 35 runs, sync logs and skips a message another business already stored (P2002) instead of failing. Tests: `tests/message-key-per-tenant.test.ts`.
- **Sync trusts the instance name**: `whatsapp/sync` takes the business id from the instance name and does not check that the instance is connected in the app, so an instance removed from the app (doctorgcenter, elfar on 2026-11-20) still stores messages. Not changed yet.

### Pending after QA 2026-11-20

- **`prisma/sql/33-chat-messaging-reactivation` is applied** (2026-11-20). Keep the rule for later changes: the sync route upserts `whatsapp_chats` without a `select`, so Prisma reads every column of the schema, and a column the code knows but the database lacks makes every incoming WhatsApp message fail to sync.
- **The two current businesses** (doctorgcenter, newy) must change the reminder lead or the quiet hours; their reminders card opens with the quiet-hours error.
- **n8n chat workflow, read-only review of 2026-11-20** (prod `NewAigent - WhatsApp Bot (Chat)`, updated 2026-11-20 04:52 UTC; stage has the same 47 nodes). Every send node already calls `POST /api/internal/whatsapp/send` (reply, greeting, confirmation, credits, failure), so the policy, kill switches, breaker and opt-out apply to the bot. Changes for the team to paste by hand are in `n8n/docs/cambios-n8n-2026-11-20.md`:
  - `request_human_help` must **not** offer `opted_out`; the server now refuses it from `bot/help` and `bot/handoff` (`SERVER_ONLY_REASONS` in `src/lib/help-handler.ts`). Only the inbound detection in `whatsapp/sync` raises it.
  - *Send WhatsApp Reply* sends no `messageKey`, so a retried execution can deliver the same reply twice; *Write Bot Message* stores it under `'bot-' + Date.now()`. Both should use `'bot-' + <inbound message id>`.
  - *Write Customer Message* (sync, which records an opt-out) and *Get Contact Status* run in parallel, so the agent still answers the "BAJA" message (credits spent). The app now answers that blocked reply with **200 `blocked: true`** (`botSendResponse`, `src/lib/messaging/bot-send-response.ts`), so n8n no longer alerts the owner ("Alert Owner: Bot Failure") or raises `send_failed`, and sync does not store a bot reply for an opted-out chat (`skipped: "opted_out"`). Chaining *Write Customer Message → Get Contact Status* removes the wasted agent call.
  - **The Webhook node has no authentication** in prod or stage; the "Guard: Webhook Secret" described above does not exist. Anyone with the URL can inject messages. Enable *JWT Auth* (HS256, secret `EVOLUTION_WEBHOOK_SECRET`) only after the variable is set in each Vercel project and every existing instance's webhook was re-set with `jwt_key`; before that, enabling it drops every message.
  - A bot reply blocked by a kill switch or a paused number is not delivered but is still stored by *Write Bot Message* (only the opt-out case is skipped).
- **Keys exposed in public history** (`EVOLUTION_API_KEY`, `INTERNAL_API_KEY`, `OPENROUTER_API_KEY`, commit `dade484`): rotation not done.
- **Cancellation notices at night**: a release or a panel cancellation inside the quiet hours is not urgent, so its notice waits for the morning (the slot is already free). Decided on 2026-11-20 to keep it that way for now; the quiet-hours check covers reminders only.
- **Business hours edited in `/admin/negocio`** are not checked against the quiet hours; a new conflict shows the next time the reminders card is opened. The night-hold rule above keeps such reminders from passing their deadline.
- **Morning backlog**: reminders held overnight drain at 3 per number per 15-minute run (12 per hour). A busy clinic could get some after their deadline; the deadline rule makes them go out at night instead only when the deadline comes before 08:30.
- **Opt-out detection** covers Spanish phrases plus "stop" and "unsubscribe"; other English phrases are not detected. The gateway finds a contact's opt-out by its `521…@s.whatsapp.net` JID only (all 13 chats on 2026-11-20 use that form); an `@lid` chat is not matched.
- **UI checks still to do in a browser**: the opt-out band in a chat, the quiet-hours error in the card and the agenda spinner, with a light and a dark tenant color, dark mode and phone width. `local-utils/minimal-ui/` is not present on this machine, so its audits were not run.
- **Privacy text**: the business notice says that a patient can stop messages by replying BAJA or STOP. It does not say that messages require consent, because in SHADOW mode they do not yet.

## Appointment Reminders and Confirmation (separate workflow, no LLM)

- **Workflow**: `n8n/workflows/n8n-reminders-workflow.json`. A Schedule Trigger every 15 minutes calls `POST /api/internal/reminders/run`. The interval sets the precision: a reminder or a release goes out at most 15 minutes late.
- **Reminder settings** (`/admin/whatsapp`, Configuración tab, "Recordatorios y confirmación" card, `PATCH /api/tenants/reminders` with only these fields): `remindersEnabled`, `reminderLeadMinutes` (60–4320 minutes, in multiples of 30, before the appointment at which the reminder goes out; the card shows them in hours with half hours), `confirmationRequired`, `confirmationDeadlineMinutes` (30–2880 minutes, in multiples of 30, before the appointment at which it is released). `confirmationDeadlineMinutes < reminderLeadMinutes` must hold (`reminder_window_invalid`).
- **Customer messages** (`/admin/whatsapp`, Configuración tab, "Mensajes al cliente" card, `PATCH /api/tenants/reminders` with only these fields): `messageLanguage` (`es` | `en`) and three optional texts (`reminderTemplate`, `confirmationTemplate`, `cancellationTemplate`). Empty = the language's default text.
- **Where to go in the reminder**: an in-person visit (and a visit from before `modality` existed) gets `Ubicación: <address>. Cómo llegar: <directions link>` after the visit details, built from the tenant's address with `locationTextForBot`; an online visit gets its `https://` Meet link (`Videollamada: ...`) instead. The request to reply SI stays last. Nothing is added when the business has no physical location or the online visit has no link. Helpers `withLocation`, `withMeetingLink` and `placeText` in `src/lib/reminder-messages.ts`; the order is built in `reminderText` (`src/lib/reminder-run.ts`).
- **A business's own text always wins over the default** (`tests/custom-vs-default-messages.test.ts` keeps this): a saved reminder, confirmation or cancellation text is the one sent; the default text is used only where the business wrote none (an empty or spaces-only text counts as none) or where the saved one cannot be filled in (logged, shown to the owner in the card). Nothing of the default is mixed into a business's own text: the default footer ("Si necesitas cambiarla...") is added only under the default reminder text, and the default confirmation request is added only under a reminder when the business has no confirmation text of its own.
- **One message per visit** (`reminderText` in `src/lib/reminder-run.ts`): the customer gets a single WhatsApp message. When a confirmation is requested and the confirmation text already names the visit (it has a service, date or time tag: `hasVisitDetailTags`), that text is the whole message and the reminder text is not sent above it, so the greeting and the details are not repeated; the address or video link is placed right after the last details line when the text has no location tag of its own (`withPlaceAfterDetails`, `placeLine`). When the confirmation text is only the short request (the default one), it still goes under the reminder text, and a visit that needs no confirmation gets the reminder text and its footer. A place line that only labels the place ("Ubicación: [Ubicación]") is dropped when there is nothing to show, also when the label is in bold, and a period that closes the sentence after a tag in bold ("*[Hora límite]*.") is not doubled after "a.m.". Tests: `tests/reminder-single-message.test.ts`, `tests/reminder-messages.test.ts`.
- **Tenant texts**: the tenant writes data with bracketed tags: `[Servicio]`, `[Fecha]`, `[Hora]`, `[Hora límite]`, `[Nombre del negocio]`, `[Nombre del médico]` (owner name, `Tenant.ownerName`, English `[Owner name]`), `[Nombre]`, `[Ubicación]`, `[Zona horaria]` (service, date, time, deadline time, business name, owner name, customer's first name, place, business time zone as "hora de Cancún"; English `[Time zone]`, valid in the three texts, ticket #111). An empty owner name removes its tag and the article before it (`renderTemplate`). A text that uses `[Nombre del médico]` or `[Ubicación]` cannot be saved while the owner name or the business address is empty: the card and `PATCH /api/tenants/reminders` return `template_needs_owner_name` or `template_needs_location`, naming the field to fill (`unfilledFields`). The owner name is required on the business page and in `PATCH /api/tenants/business` (`owner_name_required`). `[Ubicación]` (`[Location]`) is the address with directions link for an in-person visit and the Meet link for an online one; it is valid in the reminder and confirmation texts only (the cancellation text rejects it: `validateNoLocationTag`, `template_location_not_allowed`), the card offers its button only there, and a text that uses it is not given the automatic place line a second time (`hasLocationTag`). With nothing to show it renders empty and the gap is closed, so a sentence built around it ("Te esperamos en [Ubicación].") reads poorly for a business without an address. `[Nombre]` is valid in all three texts; when the visit has no customer name the tag is removed and the gap closed ("Hola [Nombre], te" becomes "Hola, te"). The rules live in `src/lib/reminder-template-rules.ts` (no server code): the settings card runs them while the owner types, marks the field and the offending fragment in red and disables Save until every text is valid; the server runs them again on save. Stored texts are re-checked at send time and fall back to the language default if invalid (`usableTemplate`). The tags are taken from the i18n dictionaries (`crm.business.token*`) and the server accepts those of any language. Never show braces or technical names to the tenant or the customer. Texts are validated on save (`PATCH /api/tenants/reminders`, rules in `src/lib/reminder-messages.ts`), because any bracketed word that is not filled in reaches the customer exactly as typed:
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
EVOLUTION_API_URL=              # https with a valid certificate (the app no longer accepts invalid certs)
EVOLUTION_API_KEY=              # Global key: server-side only, for create/fetchInstances. Never stored in the DB
EVOLUTION_WEBHOOK_SECRET=       # Evolution signs each webhook with a 10-min JWT (jwt_key header); the n8n trigger verifies it. openssl rand -hex 32, same value in n8n
PLATFORM_WA_INSTANCE=            # NewAigent's own instance: account messages such as the password reset code (src/lib/platform-whatsapp.ts). Without it no code is sent and /recuperar still answers ok
PLATFORM_WA_INSTANCE_TOKEN=     # That instance's own token (optional; falls back to the global key)

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

`npm run db:push` compares the **whole** `schema.prisma` with the real database and applies every difference. The real database has a table that belongs to n8n, `whatsapp_bot_memory` (the WhatsApp agent's conversation memory). It is declared in `schema.prisma` as `WhatsappBotMemory` only so Prisma knows it exists (since 2026-11-10); never remove that model, and never add columns or relations to it: without it `db:push` would **drop the table** and the bot would lose its memory. The project has no migration history yet (`prisma migrate` adoption is a separate task), so a schema change goes as a folder in `prisma/sql/<change>/` with:
- `up.sql`: additive when possible (new nullable columns or columns with a default), so the old code keeps working until the new code is deployed.
- `down.sql`: the exact reverse. Written by hand (Prisma does not generate it). It deletes the data held in what it removes, so it runs only to undo the change and after the code that reads it is gone.

How to make one safely:
1. Add the fields to `schema.prisma` and write both files.
2. Verify on a throwaway local PostgreSQL (same major version as production): load the schema-only dump, then compare with `DIFF_URL=<url> npx prisma migrate diff --config local-utils/prisma-diff.config.ts --from-config-datasource --to-schema prisma/schema.prisma --script` before `up.sql` (only your change shows), after `up.sql` (nothing about your change) and after `down.sql` (your change shows again). Nothing else should show: the diff is expected to be empty.
3. Take a verified backup first (`pg_dump` of the same major version, custom format, stored **outside the repo** with owner-only permissions; it holds personal data), and a fresh one right before applying. `pg_dump` refuses a server newer than itself.
4. Get explicit human approval, then apply `up.sql` in one transaction (`psql -v ON_ERROR_STOP=1 -1 -f up.sql`) and verify types, defaults and that existing rows did not change.
5. **Order: database first, code after.** New code reads the new columns; if it ships first, every appointment query fails (reminders, agenda, bot, CRM). Old code ignores extra columns, so the reverse is safe. Merging to `main` deploys through CI/CD, so a merge counts as a deploy.

Done so far: `prisma/sql/29-tenant-time-zone/` (`tenants.timeZone`, `tenants.timeZoneSource`, ticket #111): additive with defaults, tested on the local mirror (diff before, after `up.sql`, after `down.sql`; existing tenant rows unchanged), **applied to production** (confirmed read-only on 2026-11-18: both columns exist). `resolveBotTenant`, the reminders, the booking routes and both layouts select `timeZone`. `prisma/sql/28-help-requests/` (help state on `whatsapp_chats`, including `helpAssignedAt`, `users.whatsappNumber`, `tenants.helpEscalationMinutes`): additive; tested up, down and up again on the local throwaway database (an existing chat keeps the bot on and priority 0); **Applied to production on 2026-11-18** after a verified `pg_dump` backup (kept outside the repo) and an approval: the chats list, the sync route, `contact-status` and the reminders job read these columns, and they are in place. Done so far: `prisma/sql/27-appointment-soft-delete/` (`appointments.deletedAt`, `appointments.deletedById`, table `appointment_trail`, ticket #103): additive, tested on the local mirror (diff before, after `up.sql`, after `down.sql`; `down.sql` refuses while any visit is deleted or any trail row exists), **applied to production** (confirmed read-only on 2026-11-18: both columns and `appointment_trail` exist). Every appointment query filters `deletedAt`. `prisma/sql/23-user-access/` (`users.isActive`, `users.mustChangePassword` and `users.sessionVersion`, ticket #22): additive, tested on the local mirror (diff before, after `up.sql`, after `down.sql`; existing rows unchanged), **applied to production** (confirmed read-only on 2026-11-18: the three columns exist). Every session read selects these columns. `prisma/sql/19-staff-role/` (`STAFF` value in `UserRole`, ticket #21): **applied to production** (confirmed read-only on 2026-11-18: the enum has `STAFF`). The password reset lookup sends `'STAFF'` to the database. Its `down.sql` refuses to run while a STAFF user exists. `prisma/sql/22-referred-by/` (`referredByKey`, `referredByName` and an index on appointments), applied to the real database on 2026-11-06 after a verified `pg_dump` backup; additive. `prisma/sql/21-patient-intake/` (age, modality and meeting link on appointments, `Tenant.serviceModes`), applied to the real database on 2026-11-06 after a verified `pg_dump` backup (kept outside the repo); verified types, defaults and that the 32 existing appointments did not change. The throwaway-database `migrate diff` check was not run (no test database). The code that reads it is not deployed yet. `prisma/sql/16-reminder-attempts/` (ticket #16). `prisma/sql/17-plan-plus/` (PLUS value in `PlanId`), applied to production on 2026-11-05 after a verified backup; the code that uses it shipped with PR #49. There is no separate test database yet: local development uses the real one, so treat every local write as a production write.

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
- **Schema in sync**: verified on 2026-11-02 with a read-only `prisma migrate diff`: `botEnabled`, `botPausedReason` and `businessHours` are already applied. Update 2026-11-10: `whatsapp_bot_memory` is now declared in the schema (`WhatsappBotMemory`) and a read-only `migrate diff` of the real database against the schema is empty (run it with `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`; the repo's `prisma.config.ts` reads `DIRECT_DATABASE_URL`).
- **No test database**: local development and production share one database. A separate mirror database for tests, periodic backups and `prisma migrate` adoption are pending tasks.
- **Web appointments from before the time fix**: they were saved with UTC time (6 hours ahead). Fix with `local-utils/shift-web-appointments-utc-fix.mjs` (first without `--write`) and manually move the calendar events that get listed.
- **Hardcoded secrets in n8n workflows** (internal key, Evolution API key, OpenRouter key in the social campaign). Move to credentials when n8n allows it, and rotate them. **Exposed in public history (2026-11-18):** commit `dade484` committed `n8n/workflows/*.json` with the live `EVOLUTION_API_KEY`, `INTERNAL_API_KEY` and `OPENROUTER_API_KEY`. The folder is git-ignored now, but the values remain in the public repo's history. Treat all three as compromised; the fix is rotation (Evolution server env, OpenRouter dashboard, Vercel, n8n), not history rewriting. Rotating the internal key cuts the bot briefly unless the readers accept both the old and new key during the switch (14 routes read `process.env.INTERNAL_API_KEY`).
- **Social workflow**: if a publication fails after the text was generated, its tokens are not reported.
- **Pets**: the `pets` table and `appointments.petId` exist in the database, but tests with real data are pending: the database queried on Oct. 26 was empty. `local-utils/check-pets.ts` still needs to be run with a real tenant.
- **Reminders**: tested end to end locally; deploy and production verification are pending (see "Appointment Reminders and Confirmation").
- **Calendar sync fails silently**: if the connected calendar errors when booking, the appointment is saved only in the database, with no event and no notice.
- **Reminder job race**: if saving `reminderSentAt` fails after a successful send, the next run sends again; there is no lock between overlapping runs. If `releaseVisit` fails after cancelling, the customer never gets the cancellation text.
- **Password reset hardening** (security review 2026-11-06; pre-existing since PR #55, and since ticket #21 it also covers STAFF accounts): the 5-attempt cap can be bypassed with parallel `/confirm` requests (the counter is read, then incremented, and the rate limit is per server instance), so make the attempt count and the code consumption atomic; `/confirm` answers "expired" or "attempts used" only for existing accounts, which reveals them; `/request` takes longer when the account exists (it waits for the WhatsApp send). Minor: a session survives a password change made by the user in the CRM (a `/recuperar` reset now ends earlier sessions), and anyone who knows an email can spam the business WhatsApp with codes. Since ticket #22 a pending code is cleared when the password changes another way (owner card, forced change, owner reset), and a deactivated account gets no code.
- **Session check, what is left** (ticket #22 closed "JWT role is never re-read": the account row is now read on every request): `src/middleware.ts` still trusts the token, `SessionWatch` only runs on a section change, and the read has no cache. See "Authentication and Authorization".
- **Team screen, follow-ups** (ticket #22): a temporary password does not expire by time, only by use or reset; the rate limits of the team and password-change routes are in memory per server instance; staff name and email cannot be edited and users cannot be deleted from the screen; Google sign-in resolves an account by email across all businesses (pre-existing); the STAFF and deactivated block judges only the account Google signs in as.
- **Security review of 2026-11-10, pre-existing and not fixed in #22**: (1) the session cookie is shared by every subdomain of the root domain and the API handlers accept any content type, so a script running on another business's subdomain (for example through an XSS in a storefront) can make a signed-in owner's browser send a blind POST or PATCH to any owner API; it cannot read the answer. Fix for all routes: reject mutating requests whose `Origin` host differs from the request host, and require `application/json`. (2) Credentials sign-in has no attempt limit. (3) Booking by email (public `POST /api/appointments`, `bot/book`) links the visit to whichever user has that email, including a STAFF account; panel bookings (ticket #103) no longer do: they always use the phone's guest account. (4) A user's own password change does not end their other sessions (only an owner reset, a deactivation and `/recuperar` do).
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
  5. Restrict the key: under "API restrictions" choose only **Places API (New)** and **Time Zone API** (ticket #111: the business time zone is detected from the address; enable "Time Zone API" in APIs & Services > Library first). The key is used only from the server; Vercel has no fixed IP, so under "Application restrictions" leave "None".
  6. Save it without quotes: `.env` locally (restart `npm run dev`) and Vercel Environment Variables in production (redeploy).
  7. Create a budget alert in Billing to avoid unexpected charges.
  - Test: in `/admin/negocio`, turn on the switch and type an address; suggestions appear from 3 characters. If "La búsqueda no está disponible ahora" (Search is not available right now) appears, the key is missing, billing is off or the key is restricted to another API.
- **Call limit** of `/api/places/*`: 40 requests per minute per IP (`src/lib/rate-limit.ts`, in memory per server instance; it protects against abuse, it is not an exact limit).
- Phone helpers in `src/lib/phone.ts` (`buildFullPhone`, `splitFullPhone`, `PHONE_COUNTRIES`, `dialCodeForCountry`, `defaultDialCodeForZone`). Use them in any new form that asks for a phone; do not write another parser.
- **Country of the business (ticket #120, no column)**: `countryForTimeZone` (`src/lib/time-zones.ts`; each `TimeZoneOption` has a `country`, plus the Mexican zones Google returns that are not in the list) gives the country of `Tenant.timeZone`. From it come the first dial code of every phone field (Negocio when no number is saved, `/agendar`, Nueva cita, and the 10-digit completion of a staff WhatsApp in `normalizeStaffWhatsapp`) and the `currency` of `bot/context` (`currencyForTimeZone` in `src/lib/currency.ts`: MX MXN, US USD, CO COP, PE PEN, CL CLP, AR ARS, ES EUR). An unknown zone keeps +52 and MXN, as before. A saved number keeps its own dial code.
- **Signup city and country (ticket #120)**: `POST /api/places/details` also asks Google for `addressComponents` in the same call and returns `city`, `region` and `countryCode` (`placeParts` in `src/lib/address-components.ts`, null when missing). The signup modal fills City, Country and the dial code from the picked place; a dial code the owner changed by hand is not replaced. City and country are not sent or stored: the formatted address already names them. Tests: `tests/address-components.test.ts`, `tests/country-by-zone.test.ts`.

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

## Team skills (`common-skills`)

Shared Claude Code skills for the team live in a **private** repo, `smartflows-ai/common-skills` (this repo is public: keep only pointers here, never client data, bank data, tax IDs or private paths). `.claude/settings.json` registers the marketplace `smartflows-skills` and enables the plugin `common-skills`, so opening this repo offers the install. Manual install: `/plugin marketplace add smartflows-ai/common-skills` then `/plugin install common-skills@smartflows-skills`; restart the session after installing or updating.

| Skill | Use it when |
|---|---|
| `newaigent-cliente` | A new client: folder, `ficha.json`, plans, verticals, brand; also how team changes sent in chat are saved per client |
| `newaigent-contrato` | The service contract (DOCX/PDF) by plan and vertical, with amounts, VAT, dates and the exchange-rate adjustment |
| `newaigent-roadmap` | The implementation roadmap deck (PPTX/PDF) |
| `newaigent-informe-configuracion` | The week-1 configuration report, read from the real business data with an automatic audit |
| `newaigent-entrega-bot` | The week-3 delivery: acceptance record, operating guide by role, config diff against week 1, video index |
| `newaigent-manual-video` | Tutorial videos (Remotion) of the real panel, one per module and vertical, with voice, subtitles and licensed music |

Rules that apply when these skills touch this product:
- **Read-only on the real database.** The report and delivery skills read the tenant through `pull-tenant-config.mjs` (only `findUnique`, `findMany`, `count`, `groupBy`, read-only session). It never reads tokens, password hashes, QR codes or patient data. Never change it to write.
- **Videos use their own throwaway database**, never the real one: a local PostgreSQL (port 5544) with fictitious data and a copy of this repo (`git archive`, no `.env`) served on port 3100, started by `demo-entorno.mjs`. Port 3000 is never touched. Schema comes from `prisma migrate diff`, never `db push`.
- **White-label applies to everything they produce:** no provider or model names in client-facing documents or videos. A provider name seen in a capture is a bug of this product: fix it here (see "Vocabulary and White-Labeling Standards").
- **When the product changes**, the videos and the module catalog (`references/modulos.json`, which mirrors `enforcedPlan` in `src/lib/capabilities.ts`) must be refreshed: run `demo-entorno.mjs actualizar`, capture again and regenerate. A new CRM module needs a capture recipe and a script in the skills repo.
- **Where the output goes:** one root folder outside any repo (`NEWAIGENT_HOME`), with the client folders, the video library and the private machine data. Documentation and setup steps are in the skills repo README.

## Development Rules and Local Utilities

### Where tests and scripts live (`tests/` and `local-utils/`)
- **Tests** (`*.test.ts`, node:test) live in `tests/`, which is tracked and committed. Run them with `npx tsx --test tests/*.test.ts`. Pure logic goes there; I/O is injected so the tests need no database or WhatsApp.
- **Operator scripts** (checks against the database, simulators, one-off backfills, the minimal-ui audit) live in `local-utils/`. That folder is in `.gitignore` and is **never committed or pushed**. The repo is public, and these scripts reach the database or send WhatsApp messages.
- **STRICT RULE**: a utility that tests something, diagnoses the database, simulates API calls, or is not part of the production app goes in one of these two folders. Never in the project root (`./`), in untracked temporary folders such as `scratch/`, or in `src/`.
- Before any commit, PR or push, run `git diff --cached --name-only` and `git diff origin/main...HEAD --name-only`. Neither may list an added or modified path under `local-utils/`. A deletion (`D`) is allowed only when it untracks a file that used to be in git (how the legacy scripts leave the index). If an added or modified path appears, unstage it (`git restore --staged <file>`) and say so before committing.
- Never use `git add -f` on a `local-utils/` file. Never stage with `git add -A` or `git add .`: stage files by name.
- Status (2026-11-06): the test suites moved to `tests/`; the operator scripts are no longer tracked. Both changes are staged and not yet committed.

### Save buttons in settings cards
- The save button of every settings card goes on the right (`flex ... justify-end`), the same as `ReminderSettingsCard` and the team forms. Never left-aligned, even in a short card with one field. A status message ("Saved") sits beside the button, on its right side too.
- Check it in the screen: the card's button and the other cards' buttons must share the same edge.

### Form controls (use the shared classes, never a new one)
- Text and number fields use the global class `input` (`src/app/globals.css`). Do not write a field class of your own.
- The main "create" button of a CRM section (Nueva cita, Nuevo servicio, FAQ, carrusel, campañas, equipo) is `btn-primary inline-flex items-center gap-2 min-h-11 sm:min-h-0 shrink-0` with an 18 px icon (ticket #116). `btn-primary` takes its text color from `--on-primary`, so a screen never adds `text-white` to it.
- Dropdowns use `select.input` (or `select-themed`): the same field with a chevron, and hover and focus in the tenant's primary color. A select with no such class is a bug.
- A numeric setting uses `NumberField` (`src/components/ui/NumberField.tsx`): the text stays the person's while they type, so an empty or partial value is never saved as 0 and "01" never appears. Never write `value={Number(...)}` with `onChange` calling `Number(e.target.value)`; that is the bug this component fixes. Its validation is tested in `tests/number-field.test.ts`.
- Two settings in the same screen that ask for a duration use the same control and the same unit style: "Send the reminder (hours before the visit)" and "Minutes before telling the owner" are both a number field.
- Before closing a form change, compare it with a field of a nearby card (same width, same label style, same alignment of its button).

### Status in lists and rows (chats that need a person, WhatsApp)
- Color is never the only signal. Every status has an icon and a word (or an accessible label). Priority colors come from `src/components/admin/whatsapp/helpTone.ts` (`HELP_BAR_CLASS`, `HELP_TEXT_CLASS`, `HELP_COUNT_CLASS`): red for high, amber for medium, and near-black amber text on amber, never gray text on a color.
- A row has three lines at most: the name, one status line (reason and waiting time, `HelpRowBadge`), and the preview. Do not add a fourth line or a second text tag to the name line; the sidebar is about 320 px wide and tags collide.
- Per-person states that are not the reason of the row (in my charge, the customer wrote again) are icon badges on the avatar, with an accessible label and a tooltip: primary for "in my charge", red with a message icon for "wrote again". The words also appear in the open chat's banner. Do not tint these badges (the audit flags tinted panels).
- A notice that interrupts (the assignment toast) is a small card in the bottom-right corner, shows the name, the reason and one action, closes by itself after 15 seconds and has a close button. It never shows the customer's message.
- Filters are `FilterChip`s above the list: All, Need help (count), In my charge (count). A filter never hides a chat that the priority order would show first.
- The list order is decided in one place: help priority, then the viewer's chats, then other assistants' chats, then unassigned ones, most recent first (`src/lib/chat-order.ts`). A group separator is not used, because it would split the priority levels.
- Check the row at the width of the sidebar, with a long name, with two badges at once, with a light and a very dark tenant color, and in dark mode.

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
- **Text on a primary fill**: never `text-white` on `bg-primary`. Use `text-[color:var(--on-primary)]`: `--on-primary` is set with the rest of the theme (`themeColorVars` and `readableTextOn` in `src/lib/theme-vars.ts`, tests in `tests/theme-vars.test.ts`) and is **white for every tenant today** (product decision of 2026-11-11, `src/lib/theme-vars.ts`; `readableTextOn` exists but is not applied). On a very light tenant color (for example a pale pink) white text is hard to read; changing that means revisiting the decision, not the components. Shared pieces: `src/components/ui/FilterChip.tsx` (filter pills) and `src/components/ui/RadioOption.tsx` (radio rows, 44px tall on phones). `scrollbar-slim` (globals.css) gives a chip row a thin scrollbar in the tenant's primary color. Not yet swept: about 29 older `bg-primary ... text-white` uses in apps, pacientes, pedidos, productos, reviews, social-campaign, whatsapp, Pagination, ChatAssistant, CalendarView, Navbar and ProductCard.
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
- **Create, edit, delete and restore (ticket #103)**, for the owner and staff:
  - **Nueva cita**: service, day, a free time from the grid (`GET /api/appointments/availability`), the patient's WhatsApp (a known number prefills name, age and email), first name and surname (`full_name_required`) and age, optional email, modality when the service offers both, reason. Booking for another person is off in the panel (ticket #113): the block is commented out in `AppointmentFormPanel.tsx` and the API answers `field_not_allowed` to `forOtherPerson`, `requesterPhone` or `patientPhone`; the WhatsApp bot still books for others. "El paciente ya confirmó" creates it confirmed (`customerConfirmedAt`), so the reminder does not ask SI; otherwise it starts "Por confirmar". The visit always belongs to the phone's guest account; a typed email is contact data only.
  - **Editar**: service, time, name, age, email, modality and reason; the phone never changes (`field_not_editable`). The calendar event gets the new time and text, or is replaced when the modality or email changes; if a connected calendar cannot be updated the visit is still saved and the screen warns (`calendarSynced: false`).
  - **Horarios**: staff only books free times inside business hours, also through the API. The owner may type another time ("Elegir otra hora") and save on top of a visit or outside hours after confirming (`override`, permission `appointments.overbook`). A taken or out-of-hours time always answers with the 3 nearest free times (`alternatives`).
  - **Eliminar** is a soft delete (see `Appointment.deletedAt`); "Eliminadas" lists them with who and when. **Recuperar** works only before the visit's start time and never on top of another visit, for every role; a taken slot offers the nearest free times. Every return to Pendiente or Confirmada ("Reabrir" from cancelled, no-show or attended) follows the same rule for a future visit and brings its calendar event back; a past cancelled visit cannot be reopened, a past no-show or attended visit can be corrected. The card shows **Recuperar** and **Reabrir** only when the server would accept them (`canOfferRestore`, `canOfferReopen` in `appointment-admin-rules.ts`, tests `tests/restore-visibility.test.ts`); the time is read at render, so a card left open past the start can still show the button and the server refuses it.
  - **Confirmar** sends the same text as the Confirmations tab (`ownerConfirmationText`: Mexico time, business language, short video link).
  - Code: rules `src/lib/appointment-admin-rules.ts`; behavior with injected I/O `src/lib/panel-appointments-core.ts` (tests `tests/panel-appointments-core.test.ts`); real I/O `src/lib/panel-appointments.ts`, `src/lib/appointments-panel-service.ts`; screen `src/components/admin/appointments/`.

---

## WhatsApp Connection and Evolution API Integration

- **One Evolution client (D1, 2026-11-18)**: every call to Evolution goes through `src/lib/messaging/evolution-adapter.ts`. It validates TLS (no `rejectUnauthorized: false` anywhere), times out, uses each instance's own token, and never returns or logs the provider response body (it can echo a number or the message text). `whatsapp.ts`, `platform-whatsapp.ts`, `whatsapp-qr.ts`, `connect/whatsapp` and `whatsapp/status` all use it. Never add a raw `fetch` to Evolution; extend the adapter.
- **Keys**: `EVOLUTION_API_KEY` is the global key, used **server-side only** for `/instance/create` and `/instance/fetchInstances`, and is **never stored in the database**. Each instance has its own token (Evolution 2.3.7 returns it as `hash` on create); it is stored in `connected_apps.accessToken` and used for sends, QR, status and `webhook/set`. `instanceKeyOf(stored, global)` falls back to the global key for legacy rows, and `whatsapp/status` upgrades such a row to the real instance token when it next reads it. Backfill: `local-utils/whatsapp-instance-tokens.ts`.
- **Signed webhooks**: Evolution signs every webhook call with a short-lived JWT built from `EVOLUTION_WEBHOOK_SECRET` (the `jwt_key` header → `Authorization: Bearer <HS256, 10-min expiry>`). The n8n trigger must enable JWT Auth with the same secret so a forged `messages.upsert` POST is rejected. Set the secret in `.env` and in the n8n credential (same value).
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
- **Keep the migration in mind**: every WhatsApp message the team relies on (help notices, assignment reminders, owner alerts, reminders) must keep going through `sendWhatsAppMessage` / `notifyTenantOwner` with plain text, so only that module changes. Under Meta's official API a message outside the 24-hour window needs an approved template: the help notices and the assignment reminder will need one (same as the appointment reminders). The in-app toast and the counters do not depend on the channel.
- **Pending**: create the Meta app and the WhatsApp Business account, obtain the permanent access token and the number ID per tenant (it would be stored in `ConnectedApp.waInstanceId`), and get the reminder templates approved. Afterwards, switch the sending and the workflow webhook to Meta's format.
