# Changelog

All notable changes to Presto AI are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased] — 2026-10-20

### Changed
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
