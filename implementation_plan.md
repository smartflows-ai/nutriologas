# Implementation Plan: Google Calendar Integration for Web Booking

## Overview
Integrate Google Calendar event creation and availability checking into the web-based appointment booking flow. This ensures that appointments made via the website are synced to the professional's calendar (matching the WhatsApp bot behavior) and prevents double-booking by treating external calendar events as unavailable slots.

## Types
No new global types are required. We will utilize existing interfaces:
- `ExternalAppointmentItem` from `@/lib/external-calendar`
- The `event` object structure required by `createCalendarEvent` in `@/lib/google-calendar`

## Files

### Existing Files to Modify
- `src/app/api/appointments/route.ts`: 
    - Modify `POST` handler to trigger Google Calendar event creation after successful database insertion.
    - Store the returned `googleEventId` in the database for idempotency.
- `src/app/api/appointments/availability/route.ts`: 
    - Modify `GET` handler to fetch external calendar events and mark those slots as occupied.
- `src/lib/external-calendar.ts`:
    - (Optional) Ensure `fetchExternalAppointments` is optimized for the availability check.

### New Files
None.

## Functions

### Modified Functions
- `POST /api/appointments` (`src/app/api/appointments/route.ts`)
    - **Change**: After `prisma.appointment.create`, call `getConnectedProvider` and `getAppToken` for the tenant. If a `GOOGLE` provider is found, call `createCalendarEvent` from `@/lib/google-calendar`.
    - **Logic**: Map appointment details (customer name, email, date, duration) to the Google Calendar event format.
    - **Idempotency**: Update the appointment record with the `googleEventId` returned by the API.

- `GET /api/appointments/availability` (`src/app/api/appointments/availability/route.ts`)
    - **Change**: Integrate `fetchExternalAppointments` from `@/lib/external-calendar`.
    - **Logic**: 
        1. Fetch external appointments for the requested date.
        2. Extract the start times of these events.
        3. Add these times to the `occupiedHours` Set used to filter `availableSlots`.

## Dependencies
No new dependencies are required. Existing libraries (`prisma`, `google-calendar` utilities) are sufficient.

## Testing
1. **Booking Flow Test**:
    - Create a booking via the web interface.
    - Verify the record exists in the database.
    - Verify a corresponding event appears in the Tenant's Google Calendar with the client as an attendee.
    - Verify `googleEventId` is stored in the database.
2. **Availability Test**:
    - Manually create an event in the Tenant's Google Calendar.
    - Visit the booking page for that specific date/time.
    - Verify that the slot is marked as unavailable/hidden.
3. **Non-Gmail Test**:
    - Book an appointment using a non-Gmail address.
    - Verify the event is still created in the Tenant's calendar and an invite is sent.

## Implementation Order
1. **Step 1: Availability Integration**: Update `GET /api/appointments/availability` to include external calendar blocks. This provides immediate value by preventing double-bookings.
2. **Step 2: Event Creation Integration**: Update `POST /api/appointments` to create the Google Calendar event and store the ID.
3. **Step 3: Validation**: End-to-end testing of the booking $\rightarrow$ sync $\rightarrow$ availability cycle.
