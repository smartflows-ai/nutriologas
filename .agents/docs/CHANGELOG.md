# Changelog

All notable changes to Presto AI are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
