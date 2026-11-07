# Patient intake and visit modality (WhatsApp bot + web booking + calendar + CRM)

Status (2026-11-06): implemented on branch `feat/patient-intake` (commits cfe1ebf, 561001e, c71dd6d). Migration `prisma/sql/21-patient-intake` applied to the real database after a verified backup. Pending: deploy, re-import the chat workflow in n8n, test with a real number, `/ecc:code-review`. Decisions made while building: modality per business (`Tenant.serviceModes`), age asked in every vertical, web booking changed together with the bot, Meet links only for now (own link and Teams postponed), the Meet link is also added to reminder and confirmation messages.

## Context

Today the bot asks name and a **required** email on every new booking, never asks age, and has no notion of in-person vs online. It also does not know whether a WhatsApp number is already a patient, so it can re-ask. Google Calendar events always get a Meet link, even for in-person visits. The owner wants:

1. First booking from a number: ask full name, age, email (optional). The WhatsApp number is already captured.
2. Every booking: in person or online, saved in the DB and Google Calendar and shown in the CRM.
3. Email optional: no email means no calendar invite to the patient; the visit is still saved and put in the doctor's calendar.
4. Known number: never ask the patient data again. The check happens first, in the workflow/server.

Decisions already taken with the owner: modality is a **per-business setting** (in person only / online only / both); age is asked in **all verticals**; **web booking changes ship together** with the bot.

## What exists (verified)

- `Appointment` has `customerName/Phone/Email` (all nullable) and `patientKey` (phone normalized to `52`+10 digits, `src/lib/patient-key.ts`). No age, no modality, no meet link column. `userId` is required; `User.email` is required and unique per tenant.
- Patients are not a table: `src/lib/patients.ts` derives them from appointments by `patientKey` (name/phone from the latest visit). Reuse that idea for the "is this number registered" check.
- `bot/book` returns `email_required` without an email, finds/creates the `User` by email. `bot/context` returns nothing about the contact. `bot/my-appointments` matches `customerPhone` as an exact string.
- `google-calendar.ts` already omits attendees when the email is empty (no invite). It always sends `conferenceData` (Meet) and has no `location`. `microsoft-calendar.ts` has no location or online meeting; `meetLink` is always null.
- Live DB (read-only check, 2026-11-06): 32 appointments, 5 distinct `patientKey`s, every row has an email and a `patientKey`, `patient_profiles` is empty, no tenant has triage on, one tenant has a physical address. No age or modality columns.
- `PatientProfile` (triage) is unused and tied to the triage flag, so it is **not** reused.

## Design

### Data (additive, `prisma/sql/21-patient-intake/up.sql` + `down.sql`)
- `enum AppointmentModality { IN_PERSON, ONLINE }`, `enum ServiceModes { IN_PERSON, ONLINE, BOTH }`.
- `appointments`: `modality AppointmentModality NULL`, `customerAge INT NULL` (CHECK 0..120), `meetUrl TEXT NULL`.
- `tenants`: `serviceModes ServiceModes NOT NULL DEFAULT 'IN_PERSON'` (existing businesses keep today's behavior until the owner changes it).
- No new patients table. A **known patient** = latest appointment of that tenant with the same `patientKey` (any status); its name, email and age are the patient record, and a new booking copies them forward. Trade-off: deleting every appointment of a patient makes them "new" again; a `Patient` table can be added later by backfilling from appointments.

### Pure rules (TDD first): `src/lib/patient-intake.ts`
- `resolveModality(serviceModes, requested)`: one mode configured means that mode, no question; `BOTH` means the patient must choose (`modality_required` if missing).
- `intakeFor(known, input)`: returns which fields are still needed. Known patient: none. New patient: name and age required, email optional.
- `isValidAge(n)`: integer 0..120.
- `guestEmailFor(patientKey)`: stable `<patientKey>@wa.guest.local` (same pattern the triage route uses), so a no-email patient reuses one `User` instead of creating a new one per visit. `isSyntheticEmail()` covers `@wa.guest.local` and `@booking.local` for the CRM display.
- `src/lib/appointment-calendar-text.ts`: one builder for the calendar summary/description (adds `Modalidad: Presencial|En línea`, age) so the web and bot routes stop duplicating it.

### Server
- `bot/context` adds `patient` (`known`, `name`, `hasEmail`, `age`), `intake` (`askName`, `askAge`, `askEmail`) and `modalityMode` (`IN_PERSON` | `ONLINE` | `ASK`). This is the "validate first if the number is registered" step: no new n8n node, the existing Get Bot Context call carries it. Lookup uses `patientKeyOf(customerPhone)`.
- `bot/book` (versioned by a fixed body field `intake: "v2"` so the old workflow keeps working until re-imported): email optional (invalid format still rejected); known patient fills name/email/age from the record when the agent omits them; new patient without name/age returns `patient_info_required` with the missing field list; modality resolved with `resolveModality`; `User` found by email or by `guestEmailFor`. Legacy path (no `intake`) behaves exactly as today.
- `createAppointment` (`appointments-service.ts`) takes `modality`, `customerAge`; stores them; `CalendarDetails` gains `modality` and `location`; after the calendar call it also saves `meetUrl`.
- `POST /api/appointments` (web): accepts and validates `customerAge`, `modality`; same `resolveModality`; email stays optional (already handled with a synthetic user email, switch to `guestEmailFor`).
- `bot/book` response and `bot/my-appointments` return `modality` and `meetUrl`, so the agent tells an online patient the link (an email-less patient never gets an invite).
- Tenant setting: `GET/PUT /api/tenants/business` + `/admin/negocio` get the `serviceModes` select (with a hint when online is chosen and no calendar is connected, and when in-person is chosen without an address).

### Calendar
- Google: `createCalendarEvent` sends `conferenceData` only for `ONLINE` (or when `modality` is null, so the legacy n8n route is unchanged) and sets `location` to the tenant address for `IN_PERSON`. Description carries the modality line. No attendee, no invite when the email is empty (already true).
- Microsoft (v1): modality line and location in the event; Teams link is **deferred** (needs a work/school account test); the bot then says the clinic will send the link.
- `GET /api/calendar/events`: replace the hard-coded `"Consultorio / Presencial"` with the real location (address, `En línea`, or the legacy text when modality is null).

### CRM display (`/admin/citas`, calendar view, historial)
- `admin/citas/page.tsx`: `AppointmentItem` gets `modality`, `customerAge`, `meetUrl`; neutral badge Presencial/En línea next to the existing badges, age beside the name, "Abrir enlace" for online visits. `@wa.guest.local` hidden like `@booking.local`.
- `CalendarView` already renders `location`; modality flows through the events API. Historial shows modality per visit and the latest age.
- i18n: new keys in `types.ts`, `es.ts`, `en.ts` together (`t.agenda.*`, `t.crm.business.*`, `t.booking.*`). Icons from lucide-react, theme tokens only, no emojis.

### Web booking
- `BookingFlow.tsx`: age field (required), email marked optional, modality radios only when the tenant is `BOTH`; success screen shows modality and address. The page's tenant `select` adds `serviceModes`, `address`, `hasPhysicalLocation`.
- No public lookup of a patient by phone (it would expose name and age to anyone who types a number), so the web form asks each time.

### n8n (`n8n/workflows/n8n-chat-workflow-v2.json`, local edit, import needs approval)
- Prompt: replace the "pide nombre completo y correo... obligatorio" rule with blocks driven by `$json.patient`/`$json.intake`/`$json.modalityMode`: registered patient means do not ask for name, age or email; new patient means ask name, age and an optional email (say a missing email only means no calendar invite); ask presencial/en línea only when `modalityMode` is `ASK`; tell an online patient the link.
- `book_appointment`: add `customerAge`, `modality` (`IN_PERSON`/`ONLINE`), make `customerEmail` optional, add fixed `intake: "v2"`; update the tool description. No new nodes or connections.
- Do not commit this file (it holds live keys; folder is untracked).

## Rollout order (human gates)
1. Verified backup, throwaway-DB diff check (`before / after up.sql / after down.sql`), approval, apply `up.sql`.
2. Deploy code (old workflow still works through the legacy path).
3. Approval, then re-import the chat workflow.
4. Owner sets "Modalidad de atención" in `/admin/negocio`.

## Steps (TDD)
1. Failing tests: `tests/patient-intake.test.ts`, `tests/appointment-calendar-text.test.ts`.
2. SQL folder + `schema.prisma`; run the diff procedure.
3. Libs, then `appointments-service`, `bot/context`, `bot/book`, `bot/my-appointments`, `POST /api/appointments`, business API.
4. Calendar changes (Google, Microsoft v1), events API.
5. UI: negocio setting, citas, historial, BookingFlow; i18n in three files.
6. Workflow JSON edit; docs.

## Files to change (representative)
`prisma/schema.prisma`, `prisma/sql/21-patient-intake/*`, `src/lib/{patient-intake,appointment-calendar-text,appointments-service,google-calendar,microsoft-calendar,calendar-sync,patients}.ts`, `src/app/api/internal/bot/{context,book,my-appointments}/route.ts`, `src/app/api/appointments/route.ts`, `src/app/api/tenants/business/route.ts`, `src/app/api/calendar/events/route.ts`, `src/app/admin/{negocio,citas,historial}`, `src/components/shop/BookingFlow.tsx`, `src/app/(public)/agendar/[slug]/page.tsx`, `src/i18n/{types,es,en}.ts`, `n8n/workflows/n8n-chat-workflow-v2.json`.

## Docs to update after approval of each change
`CLAUDE.md` (Appointment and Tenant models, bot section "email required", schema "Done so far"), `n8n/docs/N8N_WHATSAPP_BOT_DOCUMENTATION.md` (rules, pendientes), `spec.md` (lines ~146, 244-291, 426, 449), `docs/CHANGELOG.md`, `docs/DECISIONS-LEDGER.md`, `docs/CODEMAPS/*` via `/ecc:update-codemaps`.

## Risks
- Age is a snapshot copied forward; it goes stale. Acceptable for v1.
- Behavior change: in-person events stop getting a Meet link (only for new bookings with a modality).
- Microsoft online meetings are not covered in v1.
- The model may skip a question; the server enforces `patient_info_required` and `modality_required`, so the prompt is a guide, not the guarantee.
- Local development writes to the production database: tests with real bookings use a test business and a number the owner approves.
- Other bot routes (`cancel`, `reschedule`) still match by raw `customerPhone` (ticket #17); not changed here.
- Web: age required on every web booking, since no safe prefill exists. Easy to relax to optional if the owner prefers.

## Phase 2 (not in this change)

### Meeting links: Google Meet only, for now (decision 2026-11-06)
Online visits get their video link from Google Meet, created with the event on the connected Google calendar (already built in phase 1: `meetUrl`, returned by the bot). Postponed: a business-entered own link (Zoom or another telehealth tool) and Teams links for Outlook. A business with Outlook or no calendar gets no automatic link; the bot tells the patient the clinic will send it.

### Other phase 2 items
Modality tag and meeting link in the reminder templates (`[Modalidad]` needs `TOKEN_FIELDS`, i18n labels and `ReminderValues`), editing a patient age from the CRM, a `Patient` table.

## Verification
- `npx tsx --test tests/*.test.ts` (new tests plus the existing 209), `npx tsc --noEmit`, `npm run build` (stop the dev server first).
- `node local-utils/minimal-ui/audit.js` and `theme-colors.js` on touched UI files; check empty/long values, dark mode, light and dark tenant colors, another vertical.
- DB: read-only counts before and after; confirm old rows unchanged and the new columns' defaults.
- With owner approval and a test business: new number books (asks name, age, optional email, modality); skipping the email creates the event with no invite; second booking from the same number asks nothing about the patient; online shows the link in the reply and in `/admin/citas`; in person shows the address as event location; web booking with and without email; old workflow against the new server still books.
