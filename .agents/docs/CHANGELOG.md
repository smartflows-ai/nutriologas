# Changelog

All notable changes to Presto AI are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased] — 2026-10-26

### Changed
- Reminder timing in half hours: the reminder can go out and the visit can be released at any multiple of 30 minutes. Stored in minutes (`tenants.reminderLeadMinutes`, `tenants.confirmationDeadlineMinutes`); the hour columns are legacy. The settings card shows hours (1,5 = 1 h 30 min) and blocks any window that is not valid, with the reason. The settings API checks the same bounds.
- WhatsApp bot greeting: a plain greeting gets a fixed reply from the server (no model call, no AI credits). The bot introduces itself ("soy el asistente de WhatsApp de [negocio]") when nobody wrote to the contact in the last 12 hours, not only on the first message. The chat workflow sends the reply and stores it as a bot message; the agent receives the introduction flag from the server. Re-import the chat workflow in n8n to apply.
- WhatsApp bot: a booked or rescheduled appointment includes the office address and map link when the owner set a physical location. `bot/book` and `bot/reschedule` return `location` (null without a physical location); the chat workflow prompt adds the "Ubicación" line. Re-import the chat workflow in n8n to apply.
- WhatsApp bot introduces itself in its first reply of a conversation ("Hola, soy el asistente de WhatsApp de [negocio]."). Prompt rule in the chat workflow; the reply cleaner keeps the introduction. Re-import the chat workflow in n8n to apply.
- Cancellation notice for lack of confirmation: the default text (es and en) now names the service, date and time, says the slot is free, and invites the customer to book again. Owners with their own text keep it.
- Reminders are timed from each visit, not from a clock time. `reminderLeadHours` (2 to 72) sets when the reminder goes out, and `confirmationDeadlineHours` (1 to 48) sets when an unanswered visit is released. The window between them must be at least 30 minutes; shorter windows count the visit as confirmed. The reminder goes out at the exact moment, also at night. The day-before mode and the fixed send time are removed from the screen (the columns stay as legacy).
- Database: column `tenants.reminderLeadHours` added (default 24, so existing tenants keep a day-before reminder with their deadline).
- API: `PATCH /api/tenants/reminders` rejects a deadline that is not earlier than the lead time (`reminder_window_invalid`).

### Fixed
- Released visits stayed in Google or Outlook: when the calendar token was missing (expired and not refreshed), the link was cleared as if the event had been removed. The link is now kept, and the reminders job retries the removal of cancelled visits (up to 20 per run) and clears the link only after the event is gone.
- Reminders: a visit booked after its reminder time no longer gets silence. If its release deadline is still ahead, the confirmation request goes out on the next run (about 15 minutes), and the visit is released if nobody answers SI by the deadline. Before, these visits were treated as confirmed and got no message at all.
- Newy AI appointment data (`get_appointments`): it no longer sends the patient email, visit notes or clinical notes to the model. Times are clinic time (America/Mexico_City) instead of UTC, and "today", "tomorrow" and a chosen date use clinic days instead of the server clock.

### Added
- Newy AI helper tools: `get_business_profile` (name, description, owner, address, schedule), `search_products` (public catalog fields), `get_schedule_availability` (free times for a day, same rule as booking), `get_confirmation_status` (counts only), `get_whatsapp_summary` (counts only). Product, FAQ and business tools are open to every vertical; schedule and confirmation tools follow booking.
- Check: `local-utils/check-newy-tools.ts` (read-only, live database) and new cases in `local-utils/check-vertical-profile.ts`. Helpers `clinicDateKeyOf` and `addClinicDays` in `src/lib/clinic-time.ts`.
- Documentation: spec 21.12 describes the Newy AI tools and their data limits.
### Fixed
- Newy AI could not read the business FAQs. New helper tool `get_faqs` returns the active questions and answers of the tenant (`prisma.fAQ`, always filtered by `tenantId`). It is available to every vertical. The system prompt now tells Newy to use it for FAQ questions and not to invent answers when the FAQ does not cover them.

### Added
- Pets for veterinary and pet-care businesses: `Pet` model and `Appointment.petId`. Web booking and the WhatsApp bot ask for the pet's name and species (`pet_required` without a name). The history groups by owner, shows each owner's pets, filters visits by pet, and shows the pet on every visit. The appointments screen shows the pet under the owner. The calendar title includes the pet.
- Checks: `local-utils/check-vertical-profile.ts`, `local-utils/check-pets.ts`, `local-utils/check-pets-columns.ts`, `local-utils/check-location.ts`, `local-utils/check-tenant-location-columns.ts`.
- Documentation: location database change, public Places rate limit, credits badge, and bot appointment rules are now in spec section 21 and the bot doc.- Checks: `local-utils/check-vertical-profile.ts`, `local-utils/check-pets.ts`, `local-utils/check-pets-columns.ts`.
- Database: table `pets` and column `appointments.petId` added with `prisma db execute`.

### Changed
- minimal-ui pass on recently changed screens: the credits badge card no longer tints its background on hover (border only). Codemod found no other changes; the remaining `shadow-lg` matches are overlays.
- Admin sidebar header shows the business name instead of the hardcoded "CRM Nutrición" (desktop and mobile). The name comes from the tenant; when it is empty the store fallback text is shown.

### Added
- Product form: the existing categories or specialties of the business appear as buttons under the field; clicking one fills it. Before, they only appeared as browser suggestions, which hid them once the typed text matched none.

### Added
- WhatsApp pairing QR refreshes automatically while the owner waits (about every 25 seconds, like WhatsApp Web). After about 3 minutes it shows "El código QR expiró" with a button to generate a new code. Helpers in `src/lib/whatsapp-qr.ts`; timing stored in `ConnectedApp.metadata`, no schema change.

### Changed
- Default confirmation text (reminders, es and en) is now an explicit question: "¿Confirmas tu cita? Responde SI para confirmarla…" / "Do you confirm your appointment? Reply SI…". Tenants with a saved custom text keep it.
- Sign-up logo goes straight into the tenant's folder (`newaigent/<tenantId>/logo`). The sign-up form sends the file with the registration request (multipart), and `POST /api/tenants/register` uploads it after the business exists. The public upload route (`/api/upload/public`) and its staging folder are removed.
- Storefront product cards (`ProductCard`, shared with the catalog): names wrap instead of clipping (the price no longer squeezes them), the time badge is neutral, the card has a plain border and no shadow, and the image corners use `rounded-xl`.
- Storefront home "Servicios y consultas" and "Preguntas Frecuentes": smaller headings and tighter spacing, the "Ver servicios" button uses the shared secondary style (readable on pale tenant colors), the "Ayuda" pill is neutral, FAQ questions are medium weight with a plain chevron, and answers keep the owner's line breaks.
- Storefront "Sobre Nosotros": left-aligned text column, the business description keeps its line breaks (`whitespace-pre-line`), owner and address are label/value rows with thin dividers, and the directions link is readable (neutral text with a tenant-colored underline). minimal-ui style.
- Banner renderer: `tenantId` is required (`400 tenantId is required`) and the temporary overlay goes into `<root>/<tenantId>/temp`. Before, a missing tenant wrote to a shared `campaigns` folder and the overlay sat in a shared temp folder.
- Cloudinary root folder renamed from `nutriologas` to `newaigent` (Cloudinary folder renamed with the Admin API, `local-utils/rename-cloudinary-root.ts`). The root is one constant in `src/lib/cloudinary-root.ts` and is used by the tenant uploads, sign-up uploads, banner renderer and the logo move. Existing image URLs in the database are no longer valid; the database is being recreated, so the affected business accounts are deleted and created again.
- Sign-up logo: the logo uploaded during sign-up is moved from `nutriologas/signups` into the tenant's folder (`nutriologas/<tenantId>/logo`) once the tenant exists (`moveLogoToTenant` in `src/lib/cloudinary.ts`, called by `POST /api/tenants/register`). If the move fails, sign-up still succeeds and keeps the sign-up copy. Logos from earlier sign-ups are not moved.

### Fixed
- Negocio: a logo URL that fails to load shows the empty-logo placeholder instead of broken alt text.
- Product form: the categories request is no longer cached (`force-dynamic` on `/api/products/categories` and a timestamp on the fetch), so a saved category such as "Cirugia" shows in the chips.
- Product form: the category list reloads after each product save, so a new category appears in the list straight away (before, only a page reload showed it).
- Sign-up country and phone-code selectors: the country code (for example "MX") is a small label instead of large text.
- Sign-up modal: clicking outside no longer closes it and loses the typed data. It closes with its X button; a click outside only closes open dropdowns.
- Sign-up address: when Places search is unavailable, the typed address now reaches the form (it used to show "Elige la dirección de tu negocio" after typing), and the input stays visible while typing.
- Address field (sign-up and Negocio): the input is always editable. A picked place shows below it with a clear button, and typing over a pick clears it and searches again. Before, a picked or typed value could replace the input, so typing stopped. The typed text is now the address on every keystroke (at least 5 characters), so a failed or late search can no longer drop it and Continue accepts it; only a Places pick adds coordinates.

## [Unreleased] — 2026-10-23

### Changed
- Vertical behavior now comes from one profile (`src/lib/vertical-profile.ts`). Sidebar, storefront, Newy AI and the history screens follow it for every vertical: orders, service-first catalog, and the customer group name (patients, pets, travelers, customers). Stores without booking no longer see history.
- Newy AI gets only the tools for its business: sales tools only for stores, appointment tools only with booking on. `POST /api/chat` refuses other tool calls. Per-vertical directives cover SERVICES, PET_CARE, TRAVEL and GENERAL.
- The triage page (`/admin/pacientes`) has a sidebar link when `isTriageEnabled` is on.

### Added
- Owner name and business location on the tenant: `ownerName`, `hasPhysicalLocation`, `address`, `placeId`, `latitude`, `longitude`. Captured at sign-up and in `/admin/negocio` (address picked with Google Maps search, typed fallback when search is unavailable), shown on the storefront home with a "Cómo llegar" link, and sent to the WhatsApp bot (`ownerName`, `locationText`). New public endpoints `/api/places/search` and `/api/places/details`, env var `GOOGLE_MAPS_API_KEY`.

### Changed
- Minimal UI pass on tenant screens: the calendar's dark mode colors and column headers follow the spec; the dashboard rating icon circle is neutral.
- Sidebar credits badge shows the used share as a percentage (for example "7% Usado") instead of the dollar amount; the limit stays in dollars.
- Sidebar credits badge no longer shows the dollar limit; it shows only the used percentage.
- WhatsApp bot (`local-utils/n8n-chat-workflow-v2.json`): cancel and reschedule always call `list_my_appointments` in the current turn instead of reusing an earlier list, so visits that already passed are no longer offered; the bot describes visits by service, day and time, never by ID.
- WhatsApp bot: rescheduling no longer asks for name or email. `book_appointment` is described as new bookings only, `reschedule_appointment` as the way to move a visit, and the prompt forbids using the booking tool to move one.

## [Unreleased] — 2026-10-21

### Added
- **Appointment reminders with confirmation**: one reminder per visit, the day before or the same day at a set clinic time. It asks the customer to reply SI. If there is no reply by the deadline (hours before the visit), the visit is cancelled, the calendar event is removed and the slot is freed. Replaces the old 24 h / 2 h reminders. Business settings in the "Recordatorios y confirmación" card on `/admin/negocio`.
- **Confirmation from the chat**: a clear "sí" confirms the waiting visit before the AI agent runs (`POST /api/internal/bot/confirm`). The agent has a `confirm_appointment` backup tool.
- **Confirmations tab** on `/admin/whatsapp`: visits waiting for the reply, with "Confirmar" and "Liberar ahora".
- **Reminder cost**: each reminder sent is charged at `REMINDER_COST_USD` ($0.0085 by default, Meta's Mexico utility rate from secondary sources) and counted in `AiTokenLedger.reminderCount`. The platform's own cost is `REMINDER_PROVIDER_COST_USD`.
- **Message language per business** (`messageLanguage`, es or en): all customer reminder messages, dates and times follow it. Default texts live in the translation files.
- **Owner text with plain labels**: owners insert details with buttons (Servicio, Fecha, Hora, Hora límite, Nombre del negocio, or the English labels). The server accepts the labels of every language.
- **Bot invites need an email**: the bot must collect a valid customer email before booking. `POST /api/internal/bot/book` returns `email_required` without one, so every bot appointment carries an attendee and the Google or Outlook invite goes out. The `book_appointment` tool marks the email as required.
- **Service delete is hard when unused**: `DELETE /api/products/[id]` removes the row only when no order item, review or appointment uses it. Otherwise it stays a soft delete.
- **Category autocomplete**: `GET /api/products/categories` (admin) lists the tenant's distinct categories; the product form suggests them through a native datalist.
- **No past appointments**: `POST /api/appointments` rejects a time that has already passed (`date_in_past`) for every creator, admins included. The web availability hides slots that have started today. The bot prompt tells the model not to offer past hours; the bot's availability and booking routes already enforced this.
- **Bot calendar**: `bot/context` returns `calendarText`, the next 14 clinic days with weekday, date and hours (`upcomingCalendarText` in `src/lib/business-hours.ts`). The bot prompt uses it for weekdays and dates. Previously the model computed weekdays itself and quoted wrong days (e.g. Friday 24 for Friday 23, and a closed Tuesday that was open).
- **Owner alerts (WhatsApp)**: `notifyTenantOwner()` (`src/lib/whatsapp.ts`) sends a best-effort WhatsApp message to the tenant's own connected number (`Tenant.whatsappNumber`) — the only notification channel in the app. Two triggers: (1) monthly AI credits crossing from available to exhausted, fired once per billing period from `recordTokenUsage` (`src/lib/credits.ts`); (2) the WhatsApp bot's entire model cascade failing for a customer message, via the new `POST /api/internal/bot/alert-failure`, throttled to once per 60 minutes per tenant (`Tenant.botFailureAlertedAt`).
- **WhatsApp bot credit gate**: `POST /api/internal/bot/context` now returns `creditExhausted` (from `getCreditStatus()`). The n8n workflow's new "Guard: Credits OK" node skips the LLM call entirely once a tenant's monthly credits are exhausted and sends a fixed degrade reply instead — previously the bot kept answering (and spending real money) with no cap.
- **WhatsApp bot failure handling**: the "Bot Agent" node now has `onError: continueErrorOutput`. If the entire OpenRouter model cascade fails, the customer gets a fixed apology reply (logged in the chat history) instead of total silence, and the owner is alerted. Closes the documented gap in `local-utils/N8N_WHATSAPP_BOT_DOCUMENTATION.md`.
- **Shared OpenRouter balance visibility**: `local-utils/check_shared_balance.js` sums `AiTokenLedger.realProviderCostUsd` across all tenants (current period and lifetime) — operator-only, never shown to tenants, since all tenants share one OpenRouter account with no per-tenant key.
- **Social campaign failure alerts**: `POST /api/internal/campaigns/alert-failure` notifies the tenant owner over WhatsApp when a scheduled post fails, throttled to once per 60 minutes using the campaign's existing `lastErrorAt`. The social campaign workflow's "Notify Error" node posted to `$env.WEBHOOK_URL`, which this n8n instance doesn't expose, so it silently never alerted anyone; it now calls this endpoint instead.

### Changed
- **Reminder settings moved to WhatsApp**: both reminder cards ("Recordatorios y confirmación" for timing, "Mensajes al cliente" for language and texts) are on the WhatsApp Settings tab, not on `/admin/negocio`. Each card saves only its own fields.
- **Bot tools return errors as data**: the five bot tool nodes set `neverError`, so a 409 such as `slot_unavailable` reaches the agent as a message and the customer gets a normal reply instead of a failed run.
- **Reschedule and cancel without name**: the bot no longer asks for the customer's name or email when rescheduling or cancelling. Those requests use the WhatsApp number and `list_my_appointments`.
- **Availability hides past slots today**: the web availability endpoint drops slots whose start has already passed.
- **OpenRouter cascade order**: `OPENROUTER_MODELS` now tries the free models first (`nemotron`, `gemma`, `openrouter/free`), with Claude Sonnet 4.5 and GPT-4o as a last-resort paid fallback — reversed from the previous paid-first order. A $10 top-up to the shared OpenRouter account permanently raises its free-model daily cap (50 → 1000 requests/day); trying free models first spends that unlocked capacity before touching real dollars, and avoids Claude's zero-margin cost (its real cost equals the tenant's retail rate).

## [Unreleased] — 2026-10-20

### Changed
- **Business hours (one schedule)**: `Tenant.businessHours` is the only source of booking hours. It is a weekly schedule edited in `/admin/negocio` (`src/lib/business-hours.ts`). The web availability and web booking, and the bot (`bot/availability`, `bot/book`, `bot/reschedule`), read it. The hard-coded hours are gone: the web used Mon-Sat 09:00-18:00 and the bot used 08:00-20:00 every day, so a service could show slots on the web and none in the bot. The default is Mon-Sat 09:00-18:00, Sunday closed. Public web bookings outside the hours return `outside_business_hours`. Admin-created appointments are not restricted. A day can have several blocks (up to 4), so a lunch break is a gap between two blocks; a session never spans a gap. The product form warns when a service is longer than the longest block of the week.
- **Minimal UI for tenant screens**: CRM, storefront and login/registro follow a flat, neutral style (spec in `.claude/skills/minimal-ui/references/style-spec.md`). Shared classes `card`, `btn-primary`, `btn-secondary`, `btn-ghost`, `input` and `badge` no longer use gradients, blur, heavy shadows, hover scale or uppercase labels. Tenant colors and font are unchanged.
- **Tools**: `local-utils/minimal-ui/audit.js` (read-only report) and `restyle.js` (dry run by default, `--write` to apply).
- **Agent prompts**: Designer, Dev, Code Reviewer, Tester and Orchestrator prompts now include the minimal UI rules.
- **API error codes**: customer-facing routes return `{ error: <code> }` instead of raw text. Codes are typed in `src/lib/api-errors.ts` (`apiError`) and translated in the UI with `translateApiError` (`src/i18n/validation.ts`) from `t.apiErrors`. Migrated: `appointments`, `appointments/[id]`, `appointments/availability`, `checkout`, `reviews`, `reviews/[id]`, `auth/register`, `tenants/register`, `tenants/check-slug`, `tenants/business`, `upload/public`, `chat`. Call sites: BookingFlow, ReviewForm, checkout page, registro, OnboardingModal, ChatAssistant, admin citas, admin negocio. Unknown codes show the raw text, so routes not migrated keep working.
- **Resource forms as modals**: FAQ, carrusel, productos/servicios and the social campaign form ("Nueva campaña" / edit) use the shared `FormPanel` modal (`src/components/admin/FormPanel.tsx`). The campaign list stays visible behind the modal. Productos fields follow the tenant's `vertical` and `isBookingEnabled` (`src/lib/product-form-profiles.ts`, provided through `TenantMetaProvider`).
- **Citas paginated by month** (`GET /api/appointments`, admin): the agenda loads one month (`month=YYYY-MM`) with optional `day`, `status`, `q`, `page` and `pageSize` (default 20). Counts and days-with-appointments cover the whole month. The old `limit=200` returned the oldest 200 native appointments and silently dropped newer ones. Non-admin responses are unchanged.
- **Minimal UI audit rules**: `local-utils/minimal-ui/config.js` now catches arbitrary values (`blur-[..]`, `shadow-[..]` with an optional `/NN` opacity, `rounded-[Nrem]`). The first run missed 11 of them in tenant screens. Removed with the codemod (8 shadows, 1 tinted border). The storefront "Sobre Nosotros" section lost its blurred blobs, backdrop blur and oversized radius and now uses `.card`.
- **Google sign-in hidden** on `/login` (`GOOGLE_LOGIN_ENABLED = false`). The NextAuth provider stays configured.
- **Citas card layout** (`admin/citas`): date and time on the left, service, patient and notes in the middle (notes have a label above the text), status and actions on the right. Motivo and clinical notes show the text as the bot or the patient wrote it, keeping its line breaks (`whitespace-pre-line`). No parsing of field labels, because the format depends on what the bot sends. The patient line is hidden when it repeats the service or event title (common with Google Calendar events). Uses `rounded-xl`, gray borders and `text-xs` labels.
- **Confirmations**: `ConfirmModal` replaces the inline confirm in `admin/apps` and uses the tenant primary color for the confirm action.
- **Tenant styling of remaining screens**: `TrialBanner`, `CreditsDrawer`, `admin/citas` KPI cards and action buttons, storefront footer, booking CTA, `admin/apps` integration cards, social campaign toast and setup page, `CampaignMetrics` and `CalendarView` use tenant tokens (`primary`, `secondary`, `accent`) and neutral surfaces instead of hardcoded colors or gradients.
- **Phone numbers with country code**: the booking form (`src/components/shop/BookingFlow.tsx`) and `/admin/negocio` have a country code selector. The number is stored as `+<dial><digits>` (default `+52`) via `buildFullPhone` and `splitFullPhone` in `src/lib/phone.ts`. A number typed with a leading `+` overrides the selector.

### Added
- **Patient history**: `/admin/historial` lists patients (grouped by their phone key) with visits, notes and the next appointment. `/admin/historial/[key]` shows each visit with its reason and clinical note. Clinical notes are stored per visit (`AppointmentNote`), and the notes dialog is shared between the agenda and the patient page (`src/components/admin/VisitNoteDialog.tsx`). `Appointment.patientKey` is set on every booking. Web bookings require a phone (`phone_required`).
- **Phone key normalization**: a WhatsApp mobile (`521` + 10 digits) and a 10-digit number without country code both map to `52` + 10 digits (`src/lib/patient-key.ts`).
- **Bookable vs information-only items**: `isBookable` (`src/lib/bookable.ts`) is tenant booking on AND `Product.requiresBooking`. The web cards, the product page and public booking use it. The bot gets `bookable` per item from `bot/context`; `bot/availability` and `bot/book` refuse other items with `not_bookable`. The bot prompt lists bookable services and information-only items separately, and includes the opening hours. `local-utils/backfill-requires-booking.mjs` (dry run by default) sets `requiresBooking` on services of tenants with booking on. Items of tenants with booking off are information-only from now on.
- **WhatsApp AI Bot (n8n)**: `local-utils/n8n-chat-workflow-v2.json` answers questions about services and prices, checks availability, books, lists, cancels, and reschedules appointments. The tenant is resolved from the Evolution instance name. Backed by new internal routes `POST /api/internal/bot/{context,availability,book,my-appointments,cancel,reschedule}` (`src/lib/bot.ts`).
- **Appointment reminders**: `POST /api/internal/reminders/run` sends one reminder per appointment for the closest reached offset. Driven by `local-utils/n8n-reminders-workflow.json`, which runs every 15 minutes and does not use an LLM.
- **Reminder settings on Tenant**: `remindersEnabled`, `reminderOffsetsMinutes` (default 24 h and 2 h). `Appointment.remindersSent` tracks what was sent.
- **Bot token reporting**: the bot reports its model usage to `POST /api/internal/tokens/report`, so the tenant's credits reflect bot usage.
- **Bot workflow documentation**: `local-utils/N8N_WHATSAPP_BOT_DOCUMENTATION.md`.
- **Workflow check script**: `local-utils/check-n8n-workflow.js` validates connections and node references.
- **Country code helper**: `src/lib/phone.ts` (`PHONE_COUNTRIES`, `DEFAULT_DIAL_CODE`, `buildFullPhone`, `splitFullPhone`).
- **Minimal UI skill**: `.claude/skills/minimal-ui/` (SKILL.md, `references/style-spec.md`) and scripts in `local-utils/minimal-ui/`.

- **Calendar sync layer**: `src/lib/calendar-sync.ts` (busy periods and create, update, delete of the mirror event for Google or Outlook), `src/lib/microsoft-calendar.ts` (Microsoft Graph event calls) and `src/lib/appointments-service.ts` (one booking pipeline for the web and the bot).
- **Appointment fields**: `externalProvider`, `externalEventId` and `customerEmail`. `googleEventId` stays for one release.
- **Backfill script**: `local-utils/backfill-appointment-calendar-links.mjs` copies `googleEventId` into the new fields.
- **Clinic time helpers**: `src/lib/clinic-time.ts` (`clinicDateTime`, `clinicTimeOf`, offset `-06:00`).
- **Outlook card** is visible again in `/admin/apps`. It shows a reconnect notice when the stored connection lacks write access (`integrationsUi.outlookReconnect`).
- **API error code** `calendar_sync_failed` (HTTP 502), translated in `t.apiErrors`.

- **Per-contact bot switch**: `WhatsAppChat.botEnabled` and `botPausedReason`. CRM toggle in the chat header (`PATCH /api/apps/whatsapp/chats/[id]`), owner send box (`POST /api/apps/whatsapp/chats/[id]/send`), and n8n check `POST /api/internal/bot/contact-status`. Owner messages from the phone pause the bot too. The bot's own replies (and their echoes) do not.
- **n8n workflow nodes**: `Get Contact Status`, `Guard: Bot Enabled`, `Guard: Owner Message`, `Store Owner Message`.
- **Shift script** `local-utils/shift-web-appointments-utc-fix.mjs` (dry run by default, `--write` to apply).
- **Booking lock**: `pg_advisory_xact_lock` per tenant and clinic day in `src/lib/appointments-service.ts`.
### Changed
- `PATCH /api/tenants/business`: `whatsappNumber` is required and must be `+` followed by 8 to 15 digits. The business profile page enforces the same rule. Existing tenants without a number must add one on their next save.
- `createCalendarEvent` adds attendees only when an attendee email is given.
- Google Calendar: `updateCalendarEvent` (reschedule) and `deleteCalendarEvent` (cancel). A missing event (404/410) is not an error on delete.
- Bot prompt: greets only on the first message, lists services when asked for prices, and follows privacy rules that keep technical details and other customers' data out of replies.

- n8n bot checks fail closed. `Get Contact Status`, `Get Pending Messages` and both guards stop the run when a check fails, instead of letting the bot answer.
- **Route check** `local-utils/check-prod-routes.mjs` probes every API route the workflows call. Run it after each deploy.
- Web availability uses the same busy check as booking (native appointments and the connected calendar).
- A logged-in admin's web booking goes to a guest account from the form email. Logged-in customers keep their own bookings.
- `sendWhatsAppMessage` accepts a full JID, so `@lid` chats can receive replies.
- n8n: the bot records its reply before sending it, and the send reads the text from `Clean Reply`.
- `POST /api/appointments` and the bot `book` route use the shared service. Web bookings check conflicts against native rows and the connected calendar and return 409 `slot_unavailable` on a conflict.
- `PATCH /api/appointments/[id]`: a date change moves the mirror event and restarts reminders (admin edits skip the conflict check). CANCELLED or NO_SHOW deletes the mirror event.
- `DELETE /api/appointments/[id]` deletes the mirror event before the row and returns 502 `calendar_sync_failed` if that fails.
- Bot `cancel` and `reschedule` sync the calendar through the shared service and now support Outlook as well as Google.
- Web bookings store only the patient's reason in `notes`. Name and phone stay in their own columns and appear in the calendar event description.
- Microsoft OAuth scope is `Calendars.ReadWrite` in start, callback and token refresh. Existing Outlook connections must reconnect.
- `GET /api/appointments/availability` compares slots in clinic time.

### Fixed
- Duplicate appointments in `/admin/citas` when a booking also existed as a calendar event. A calendar event that mirrors a native row is now hidden, in both the agenda and `/api/calendar/events`.
- Booking times were sent as UTC. A 17:00 slot was stored as 11:00 Mexico time, and availability compared UTC hours. Booking now uses clinic time.
- A booking made while logged in as the admin was attributed to the admin account, and the CRM showed the admin email. The customer's email is now stored in `customerEmail`.
- The "Motivo" text showed `reason | Tel: … | Paciente: …`. The notes now hold only the reason.
- Bot tools failed with "Instancia de WhatsApp no encontrada". Tool and code nodes read the webhook data with `$('Extract Message').item`, which n8n cannot resolve there. They now use `.first().json`.
- The agent failed with "Received tool input did not match expected schema" when an output parser was connected. The bot no longer uses one.
- Replies sent by the bot could be logged as empty in the conversation history.
- Booking form: the phone field now validates the number on submit (country code plus digits) instead of accepting any text.

### Pending
- `npm run db:push` is needed for the reminder fields. Not applied yet.
- WhatsApp Cloud API (Meta) migration is not started in code.
- Dark mode contrast with a very dark tenant primary (for example `#000000`): the sidebar title, the active nav icon, the booking step numbers and the selected booking date lose contrast on the dark background. Decide between automatic text color and a lightened primary on dark surfaces, or fix only these spots.
- Four photo overlays (carousel, product card, social campaign image) keep their gradient scrim on purpose. Confirm with the user before removing.
- Social campaign "Nueva campaña" is still a page view, not a modal.
- API error codes not done yet: `checkout/verify-payment`, `checkout/confirm`, `pedido/[id]`, `orders`, `credits`, `apps/connect/whatsapp`, `apps/facebook/post`, and `tenants/check-slug` (returns codes but is not typed). `/api/internal/*` and webhooks stay as they are on purpose.
- `CustomerAppointmentsList` cancels silently on failure (no message shown).
- Six `confirm()` calls and one `alert()` still use native dialogs. The `ConfirmModal` replacement is optional.
- Visual check pending in light and dark mode at 375 px, with a non-black primary and a custom font.
- `npm run db:push` also adds `externalProvider`, `externalEventId` and `customerEmail` to `Appointment`. After it runs, execute `node local-utils/backfill-appointment-calendar-links.mjs`.
- Outlook connections made before this change must be reconnected to enable event sync.
- Web bookings made before the clinic-time fix are stored 6 hours early. Correct them with `local-utils/shift-web-appointments-utc-fix.mjs` (dry run first).
- `npm run db:push` is needed for `WhatsAppChat.botEnabled` and `botPausedReason`. Not applied yet.
- Re-import `local-utils/n8n-chat-workflow-v2.json` into n8n. The file is not tracked by git; the pre-change copy is only in the session scratchpad.
- Web bookings made before the notes change keep the old "Motivo" text.

---

## [2.1] — 2026-10-17

### Added
- **Unified Scheduling Hub (`/admin/citas`)**: Single unified agenda with interactive mini-calendar and normalized multi-source event list merging native CRM bookings with external Google Calendar and Microsoft Outlook events.
- **Business Verticals & Service-Based Commerce**: `BusinessVertical` (`ECOMMERCE`, `HEALTH`, `PETS_HOTEL`, `TOURISM`) supporting services without physical inventory, appointment booking (`/agendar/[slug]`), and patient portal (`/mis-citas`).
- **Automated WhatsApp Patient Confirmation**: `PATCH /api/appointments/[id]` automatically notifies patients via WhatsApp when an appointment is confirmed by the provider.

### Changed
- **Evolution API Instance Configuration**: Strictly enforced required creation and sync flags: `MESSAGES_UPSERT`, `webhookBase64: true`, `rejectCall: true`, `groupsIgnore: true`, `readMessages: true`, `alwaysOnline: true`, `readStatus: false`.
- **WhatsApp QR Modal Handshake**: Replaced disruptive socket connect polling with non-invasive `fetchInstances` state checks (`connectionStatus === "open"`, `ownerJid`), resolving modal hanging upon mobile scan and enabling auto-close in 1.2 seconds.
- Consolidated `/admin/calendario` to redirect directly to `/admin/citas`.
- **Vertical-Aware Admin Sidebar**: `AdminSidebar` now hides the "Pedidos" nav item for service-only verticals (`HEALTH`, `TOURISM`, `PETS_HOTEL`). Only `ECOMMERCE` tenants see the orders link. Controlled by a new `isOrders` flag on `NavItem` filtered by `isEcommerce = vertical === "ECOMMERCE"`.
- **Vertical-Aware Public Storefront Navbar**: `(public)/layout.tsx` now passes `vertical` from Prisma to `<Navbar isEcommerce={...}>`. For non-ecommerce tenants, the shopping cart icon, mobile cart drawer link, desktop "Mis Pedidos" pill, and mobile "Mis Pedidos" link are all hidden — keeping the UI focused on service booking (`/mis-citas`).

---

## [1.2] — 2026-07-21

### Added
- Interview date + time picker in `ScheduleInterviewModal` — sessions now expire at 23:59:59 local on the selected interview date.
- `interviewDate` (YYYY-MM-DD) and `interviewTime` (HH:MM) fields persisted to Firestore session doc.
- Fullscreen AI evaluation loading overlay in `Room.jsx` — blocks UI during report generation with stage-by-stage progress (closing → generating → saving → auditing).
- Multi-agent SDLC team scaffolded under `.agents/` — Orchestrator, BA, Architect, Designer, Dev, Code Reviewer, Tester, Security, DevOps, SRE, Docs.

### Changed
- Session TTL logic changed from fixed 3-hour window to end-of-selected-day expiry.
- "Ask Claude now" / "Ask Claude anything" AI co-pilot UI renamed to **Presto AI** across all components, document titles, and locale strings.
- `generatingReport` locale key updated to "Generating AI Report…".

### Fixed
- Positions page loading indefinitely ("Loading…") — resolved in `PositionsManager.jsx`.

---

## [1.1] — 2026-07

### Added
- Jitsi mirror fallback system (element.io → jit.si).
- Mute sync: Jitsi mic mute state disables `useTranscription`.
- Session auto-completion bug fix: leaving video call no longer sets `status: 'completed'`.
- Link regeneration modal (`RegenerateLinkModal`) in Room + PositionDetail.
- Favicon + PWA manifest.
- EN / ES internationalization (react-i18next).

---

## [1.0] — 2026-07

### Added
- Initial release: login, admin dashboard, positions CRUD, interview scheduling, live room (transcription + Q&A + challenges), session evaluation, CV pre-screen analysis, candidate comparison.
