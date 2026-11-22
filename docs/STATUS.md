# Estado, pendientes y bitácora

> Movido desde `CLAUDE.md` el 2026-11-20 para que no se cargue en cada mensaje. No lo lee Claude por sí solo: ábrelo cuando la tarea toque pendientes, producción o QA.


### Pending after the wave of 2026-11-23 (branch `fix/ola-23-nov`, plan `.claude/plans/ola-23-nov.plan.md`)

- **Deploy and real WhatsApp checks (Monday 23-nov)**: the bot changes (#128 `bot/context`, #129 `bot/help`, #74 reply to SI) only reach WhatsApp after the deploy, because n8n calls the deployed app. Checks C1-W, C2-W, C4-W of the plan, from the test number `…2968` (never `…1960`, which is newy's own line).
- **n8n by hand**: `n8n/docs/cambios-n8n-2026-11-23.md`. Most urgent: #129, because the agent still promises "una persona del equipo te dará seguimiento" in the same reply when the app answers `not_requested` (only a booking for someone else with no request, name or complaint). The prompt keeps "molesto o enojado".
- **#127 not done**: recalculating booked visits and moving calendar events when the zone changes. Only the review, the confirmation and the address check shipped.
- **#128 friction left**: a patient stored as a nickname ("Anita") who gives a full name with another first word ("Ana Garza") still gets `patient_phone_required` (#72 compares first names).
- **newy data, left as is**: its saved cancellation text starts with `[Zona horaria]` glued to "Hola" ("hora de MonterreyHola…"). Its zone moved Cancún → America/Monterrey on 2026-11-20 (approved test of C2).
- **Test visits on newy**: `…2968`, Tue 24-nov 16:00, in person, confirmed (C3); it gets a real reminder on Tuesday about 13:00. The R0 visit on `…1960` is soft-deleted.
- **Improvement, not a bug**: `/ubicacion` shows no WhatsApp preview card (it redirects straight to Google Maps).
- **Admin dark mode**: the panel does not follow the system dark mode (`<html class="light">`); not checked whether it is by design.

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




## Schema changes applied (history)


Done so far: `prisma/sql/29-tenant-time-zone/` (`tenants.timeZone`, `tenants.timeZoneSource`, ticket #111): additive with defaults, tested on the local mirror (diff before, after `up.sql`, after `down.sql`; existing tenant rows unchanged), **applied to production** (confirmed read-only on 2026-11-18: both columns exist). `resolveBotTenant`, the reminders, the booking routes and both layouts select `timeZone`. `prisma/sql/28-help-requests/` (help state on `whatsapp_chats`, including `helpAssignedAt`, `users.whatsappNumber`, `tenants.helpEscalationMinutes`): additive; tested up, down and up again on the local throwaway database (an existing chat keeps the bot on and priority 0); **Applied to production on 2026-11-18** after a verified `pg_dump` backup (kept outside the repo) and an approval: the chats list, the sync route, `contact-status` and the reminders job read these columns, and they are in place. Done so far: `prisma/sql/27-appointment-soft-delete/` (`appointments.deletedAt`, `appointments.deletedById`, table `appointment_trail`, ticket #103): additive, tested on the local mirror (diff before, after `up.sql`, after `down.sql`; `down.sql` refuses while any visit is deleted or any trail row exists), **applied to production** (confirmed read-only on 2026-11-18: both columns and `appointment_trail` exist). Every appointment query filters `deletedAt`. `prisma/sql/23-user-access/` (`users.isActive`, `users.mustChangePassword` and `users.sessionVersion`, ticket #22): additive, tested on the local mirror (diff before, after `up.sql`, after `down.sql`; existing rows unchanged), **applied to production** (confirmed read-only on 2026-11-18: the three columns exist). Every session read selects these columns. `prisma/sql/19-staff-role/` (`STAFF` value in `UserRole`, ticket #21): **applied to production** (confirmed read-only on 2026-11-18: the enum has `STAFF`). The password reset lookup sends `'STAFF'` to the database. Its `down.sql` refuses to run while a STAFF user exists. `prisma/sql/22-referred-by/` (`referredByKey`, `referredByName` and an index on appointments), applied to the real database on 2026-11-06 after a verified `pg_dump` backup; additive. `prisma/sql/21-patient-intake/` (age, modality and meeting link on appointments, `Tenant.serviceModes`), applied to the real database on 2026-11-06 after a verified `pg_dump` backup (kept outside the repo); verified types, defaults and that the 32 existing appointments did not change. The throwaway-database `migrate diff` check was not run (no test database). The code that reads it is not deployed yet. `prisma/sql/16-reminder-attempts/` (ticket #16). `prisma/sql/17-plan-plus/` (PLUS value in `PlanId`), applied to production on 2026-11-05 after a verified backup; the code that uses it shipped with PR #49. There is no separate test database yet: local development uses the real one, so treat every local write as a production write.



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
