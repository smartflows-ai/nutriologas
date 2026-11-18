# WhatsApp bot QA, November 2026: findings log

Living list of the defects found in the multi-user QA of the WhatsApp bot (13 and 14 November 2026, one business, 11 chats with different numbers at the same time). One row per defect. No patient data, phone numbers or names: the repository is public. n8n execution numbers are kept as pointers.

Status: **Open**, **Fixed in code** (merged or on a branch, not yet verified with real WhatsApp), **Pending n8n** (the change exists in the local workflow file, which is not in git, and has to be imported with a backup and approval), **Verified**.

## Defects

| Id | Priority | Defect | Cause | Status |
|---|---|---|---|---|
| QA-01 | P1 | The time of an appointment is read in UTC (a 7:30 p.m. visit is announced as 1:30 a.m. the next day); a "move" to the same instant answers "rescheduled" | `my-appointments` and `cancel` return `toISOString()`; no single place builds what the bot says about an appointment | Open |
| QA-02 | P1 | Rescheduling an online appointment answers with the office address and says the team will send the link | `reschedule` always returns `location` and no modality or link | Open |
| QA-03 | P0 | A reply the bot generated never reached the customer (8 min without an answer) and nobody knew | The reply is saved as sent before it is sent, and the send node has no retry or error branch; the owner alert wrote its cooldown before sending | Fixed in code (cooldown after the notice, `owner-alert.ts`); **Pending n8n** (retry, error branch, marking the chat) |
| QA-04 | P1 | False availability: "no hours" when free, the wrong day, ten hours from memory, "7:30" assumed p.m., "Saturday 15" accepted when it is a Sunday, week schedule answered with the opening hours | The tool only listed the next 3 hours after a time; no exact-hour query, no weekday in the answer; the prompt did not forbid answering without calling it | Fixed in code (`time`, `edge`, `weekday`, `slot-query.ts`); **Pending n8n** (tool description and prompt) |
| QA-05 | P1 | A weekday configured as "03:00 to 20:00" offered and booked 3:00 a.m. visits | Business hours accept any start before the end | Open (data fix for the business; a confirmation when a block starts before 06:00 or ends after 22:00 is planned; red test `tests/business-hours-range.test.ts`) |
| QA-06 | P2 | A customer who wants to buy a physical item is told "the team will follow up" and nobody is told | No hand-off | Fixed in code (HITL, `request_human_help`); **Pending n8n** |
| QA-07 | P2 | Nobody sees which chats need a person | The chats screen only shows a grey "bot paused" icon | Fixed in code (priority, colors, assistant, escalation); migration 28 **not applied** |

## Known and not yet fixed

| Id | Priority | Defect |
|---|---|---|
| QA-08 | High | The reminders job can release an appointment while the customer's "SI" is being processed (`cancelAppointment` updates by id only). |
| QA-09 | High | `bot/book` has no idempotency: a retry after a timeout says it failed although the appointment was created. |
| QA-10 | High | `patientPhone` exposes the registered name of another number and lets the booker overwrite that record. |
| QA-11 | High | The connected calendar fails open: with a revoked token the doctor's personal events are ignored; a failure to update the event is answered as success. |
| QA-12 | Medium | No time zone per business: `-06:00` is fixed in three places (`clinic-time.ts`, `bot.ts`, `google-calendar.ts`); cities that follow US daylight saving time get the wrong offset in summer. Plan: `Tenant.timeZone` (IANA), chosen by the owner in `/admin/negocio`, and the API answers already formatted in that zone. |
| QA-13 | Medium | The n8n webhook has no authentication and the internal key is one for all businesses. |
| QA-14 | Medium | A `@lid` contact without an alternative is dropped silently; the memory key sometimes uses `521...` and sometimes `52...`. |
| QA-15 | Medium | `reschedule` does not check `isBookingEnabled`, an active service or a limit of reschedules. |
| QA-16 | Medium | Booking for another person with the same phone number loops ("the number is not valid") and never books. |
| QA-17 | Medium | `calendarText` does not know the current time: it offers today's hours that already passed. `availability` answers in 24 h while other routes use 12 h. |
| QA-18 | Medium | No bot route leaves a log or an audit row. |
| QA-19 | Medium | The server greeting ignores a question that was waiting for an answer. |

## Security action for the team (not code)

The n8n workflow files that were committed to this public repository contained the messaging provider key and the internal key in clear text. Rotate both and keep the workflow files out of the repository (`n8n/workflows/` is listed in `.gitignore`).
