---
paths:
  - "src/app/admin/citas/**"
  - "src/components/admin/appointments/**"
  - "src/lib/appointment-*.ts"
  - "src/lib/panel-appointments*.ts"
  - "src/lib/appointments-*.ts"
  - "src/lib/visit-notes.ts"
  - "src/app/api/appointments/**"
  - "src/app/*/agendar/**"
  - "src/app/*/mis-citas/**"
---

> Moved from `CLAUDE.md` on 2026-11-20. Loads only when a matching file is read.

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
