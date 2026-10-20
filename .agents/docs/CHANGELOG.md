# Changelog

All notable changes to Presto AI are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased] — 2026-10-20

### Changed
- **Minimal UI for tenant screens**: CRM, storefront and login/registro follow a flat, neutral style (spec in `.claude/skills/minimal-ui/references/style-spec.md`). Shared classes `card`, `btn-primary`, `btn-secondary`, `btn-ghost`, `input` and `badge` no longer use gradients, blur, heavy shadows, hover scale or uppercase labels. Tenant colors and font are unchanged.
- **Tools**: `local-utils/minimal-ui/audit.js` (read-only report) and `restyle.js` (dry run by default, `--write` to apply).
- **Agent prompts**: Designer, Dev, Code Reviewer, Tester and Orchestrator prompts now include the minimal UI rules.
- **Resource forms as modals**: FAQ, carrusel and productos/servicios use the shared `FormPanel` modal (`src/components/admin/FormPanel.tsx`). Productos fields follow the tenant's `vertical` and `isBookingEnabled` (`src/lib/product-form-profiles.ts`, provided through `TenantMetaProvider`).
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

### Changed
- `PATCH /api/tenants/business`: `whatsappNumber` is required and must be `+` followed by 8 to 15 digits. The business profile page enforces the same rule. Existing tenants without a number must add one on their next save.
- `createCalendarEvent` adds attendees only when an attendee email is given.
- Google Calendar: `updateCalendarEvent` (reschedule) and `deleteCalendarEvent` (cancel). A missing event (404/410) is not an error on delete.
- Bot prompt: greets only on the first message, lists services when asked for prices, and follows privacy rules that keep technical details and other customers' data out of replies.

### Fixed
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
- Visual check pending in light and dark mode at 375 px, with a non-black primary and a custom font.

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
