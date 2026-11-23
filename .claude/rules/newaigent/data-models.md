---
paths:
  - "prisma/**"
  - "src/lib/appointments-service.ts"
  - "src/lib/bookable.ts"
  - "src/lib/price-*.ts"
  - "src/lib/assessment-target.ts"
  - "src/lib/patient-*.ts"
  - "src/lib/patients.ts"
  - "src/lib/pets.ts"
  - "src/lib/connected-apps.ts"
  - "src/lib/oauth-refresh.ts"
  - "src/lib/business-hours.ts"
  - "src/lib/location.ts"
  - "src/app/api/appointments/**"
  - "src/app/api/products/**"
  - "src/app/api/orders/**"
  - "src/app/api/tenants/**"
  - "src/app/api/internal/triage/**"
---

> Moved from `CLAUDE.md` on 2026-11-20. Loads only when a matching file is read.

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
- `priceMode` (`PriceMode`: `FIXED`, `FROM`, `ON_REQUEST`; default `FIXED`) → a price can be exact, a starting price ("From $X") or defined after the assessment (stored as `price = 0`, never shown). `assessmentProductId` (nullable) → for an `ON_REQUEST` item, the service to book to learn the price (a priced, bookable, visible service of the same business). An item with a valid target is not booked itself (`requiresBooking` is forced to false on save); the product page offers "Book <target>", and with no target an on-request item offers "Ask about the price" on WhatsApp. The target is checked on save and again on read (`resolveAssessmentTarget`, `loadAssessmentTargets`), so a deleted, hidden or changed target silently stops redirecting. One module decides everything: `src/lib/price-display.ts` (`priceView`, `isPurchasable`, `storeAction`, `normalizePriceInput`, `sortByPrice`) and, for text sent to machines, `src/lib/price-text.ts` (`priceFieldsFor`: `price` is null on request, `priceText` is the sentence to use, in the business `messageLanguage`). A whole amount reads "$2,300" and an amount with cents "$2,300.50" through `formatPriceForMachines` (ticket #167); the screens keep `formatPrice` with two decimals. Money paths: `api/checkout` and `api/orders` answer `price_not_fixed` for any item that is not a fixed price above zero. A free service is a fixed price of 0 typed on purpose (shown as "Gratis"; the new-service form starts with an empty price and an empty price is refused with `priceRequired`, so nothing becomes free by accident; physical items cannot be free). `bot/context` returns `priceMode`, `priceText`, `price` (null on request) and `bookInstead` per service; `bot/book` on an on-request service answers `not_bookable` with the service to offer. `prisma/sql/25-product-price-mode` applied to the real database on 2026-11-10 after a verified pg_dump backup (5 products, all FIXED afterwards); pending: the n8n chat prompt and the social campaign workflow must be checked before deploy (a `null` price could print as the word "null"). Plan: `.claude/plans/price-by-diagnosis.plan.md`; recording the final price per visit (`Appointment.finalPrice`) is phase 2.
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
