# Visit modality per service (in person only / online only / both)

Status (2026-11-10): plan, waiting for approval in the canvas. No code written.

## Problem

The business-level setting `Tenant.serviceModes` ("How you see patients": in person, online, both) was shipped in the patient-intake work. With `BOTH`, the bot and the web booking ask "in person or online?" for **every** service. But modality is really a property of the **service**: Planificacion Familiar, a physical exam, a vaccine, a grooming, a tour all need the person (or pet) on site, while a follow-up or a nutrition consult can be online.

Real case (2026-11-09, WhatsApp): the bot asked "presencial o en linea?" for Planificacion Familiar, the patient chose in person, then asked "seguro que se puede en linea?" and the bot answered "my mistake, it is not available online". The question should never have offered the option, and the bot should not need to guess.

## Root cause (verified in code)

- `src/lib/patient-intake.ts`: `resolveModality(serviceModes, requested)` only knows the business setting. Nothing knows about the service.
- `bot/context` (`src/app/api/internal/bot/context/route.ts:94`) sends one global `modalityMode` and a `products` list with no modality data, so the agent cannot know which service allows what. It asks for all of them, and when challenged it invents an answer from the prompt text.
- `bot/book` (`route.ts:110`) and `POST /api/appointments` (`route.ts:264`) validate the modality against the business only, so a booking of an in-person-only service as ONLINE is accepted and creates a Meet link.
- `BookingFlow.tsx:521` shows the radios whenever `tenant.serviceModes === "BOTH"`, for every service.
- `Product` has no field for it (`serviceConfig` JSON exists but nothing reads it, and the zod schema is `z.record(z.any())`, so it is not a safe place for a rule the server must enforce).

## Decision (confirmed: keep both)

Keep the business setting **and** add a per-service setting. The business setting is the **default**; the service setting, when present, **overrides** it (the owner chose it explicitly for that service). There is no conflict state.

| Business `serviceModes` | Service `visitModes` empty (inherit) | Service = IN_PERSON | Service = ONLINE | Service = BOTH |
|---|---|---|---|---|
| IN_PERSON | in person, no question, **but tell the customer** | in person | online, no question, **but tell the customer** | ask |
| ONLINE | online, no question, **but tell the customer** | in person, no question, **but tell the customer** | online | ask |
| BOTH | **ask** (today's behavior, unchanged) | in person, no question, **but tell the customer** | online, no question, **but tell the customer** | ask |

- **Default is "inherit the business"** (null): every existing service behaves exactly as today. No surprises on deploy; the owner marks the exceptions.
- **No conflict case**: because the service wins, no combination is invalid, so there is no `modality_unavailable` error and no warning when the business setting changes. The only error the customer path can hit is `modality_not_available` (the asked mode is not one the service allows) and `modality_required` (ask mode, nothing sent).
- **Prerequisites stay honest**: an online service needs a connected calendar for the automatic Meet link, an in-person one needs the business address. The product form shows a neutral hint (not a block) when the chosen mode lacks its prerequisite, as the business form already does.
- Alternative considered and rejected: a second business-level toggle "some services are in person only". It does not express which ones, and the bot would still need a list.
- Alternative considered and rejected: infer from the service name or description with the model. Forbidden by the multi-tenant rule (no parsing free text, no business-specific wording) and it is exactly the guess that failed.

## Design

### Data (additive, `prisma/sql/23-product-modes/up.sql` + `down.sql`)
- `products.visitModes ServiceModes NULL` (reuses the existing `ServiceModes` enum: `IN_PERSON`, `ONLINE`, `BOTH`). `NULL` = inherit the business.
- Additive and nullable: old code ignores it, so database-first deploy is safe. `down.sql` drops the column (data loss for that column only, run after the code is gone).
- Follow "Schema changes" in CLAUDE.md: backup, local mirror check, explicit approval before applying to the real database. No `db:push`.

### Pure rules (TDD first): `src/lib/patient-intake.ts` (or a new `src/lib/service-modality.ts`)
- `effectiveModes(business: ServiceModes, service: ServiceModes | null): Modality[]` returns the allowed list (1 or 2 items): the service value when set, otherwise the business value.
- `modalityModeFor(business, service): ModalityMode`: `IN_PERSON` | `ONLINE` | `ASK`.
- `resolveModality(business, requested, service?)`: new optional third argument. With one effective mode it decides alone; with two it needs the patient's choice; if `requested` is outside the effective list it returns `modality_not_available` (the patient asked for online on an in-person-only service). Keep the old two-argument behavior when `service` is undefined (the old n8n workflow keeps working).
- Tests in `tests/patient-intake.test.ts`: full 3x4 matrix above, invalid requested value, requested mode not allowed, legacy call without service.

### Server (every place that creates or answers about a visit)
- `POST /api/internal/bot/context`: each product gets `modalityMode` (`IN_PERSON` | `ONLINE` | `ASK`) and `modalities` (e.g. `["IN_PERSON"]`). The global `modalityMode` stays for the old workflow but the prompt switches to the per-service one. This is the fix for the bot: the agent reads the answer from data instead of inventing it.
- `POST /api/internal/bot/book`: look up the product **before** resolving modality (today the order is modality first, product later), then `resolveModality(bot.serviceModes, modality, product.visitModes)`. Errors: `modality_required` (ASK and nothing sent), `modality_not_available` (sent value not allowed for this service, message names the allowed one so the agent can say it plainly). Messages in Spanish for the agent, like the existing ones.
- `POST /api/appointments` (web): same change, product is already loaded after the modality check, so reorder. Admin sessions keep the current leniency (may leave modality out) but still cannot pick a mode the service forbids.
- `bot/availability`: no change in slots, but return the service's `modalityMode` so the agent knows before offering times. Optional; confirm it is worth the extra field.
- `bot/my-appointments`, reminders, calendar events: unchanged, they read `Appointment.modality` that is now always valid.
- `src/lib/bookable.ts` is not touched; a modality error is a separate reason code, not "not bookable", so the message stays accurate.
- `src/lib/ai/execute-tool.ts` (Newy AI catalog search): add the modes to the public catalog fields so the owner's copilot can answer "which of my services are online". Check `toolsFor()` vertical rules; no change to who sees it.

### Admin: product form (`src/app/admin/productos/page.tsx`, `POST/PUT /api/products`)
- New field "How is this service delivered?" (select: "Same as my business", "In person only", "Online only", "In person and online"), shown only for bookable items (`requiresBooking`) and only when the business offers more than one mode. When the business is single-mode the field is hidden (nothing to choose) and any stored value is ignored by the rules.
- Shown always for bookable items (a single-mode business may still have one exception). All four options are offered; "Same as my business" is the default. A neutral hint appears when the chosen mode lacks its prerequisite (online without a calendar, in person without an address).
- `src/lib/validations/index.ts`: add `visitModes: z.enum([...]).nullable().optional()`; both product routes persist it with the tenant check they already have. `tenantId` always from the session.
- Business form (`/admin/negocio`): reword the hint under "How you see patients" so it says the default for services and that each service can override it. Services with their own value keep it when the business setting changes.

### Web booking (`BookingFlow.tsx`, `agendar/[slug]/page.tsx`)
- The page passes the product's `visitModes` along with `serviceModes`; the component computes the effective mode with the same pure function (shared, no server code): radios only for `ASK`; a single mode shows a read-only line ("In person at <address>" / "Online, you will receive the link") instead of nothing.
- Product detail page (`producto/[slug]`): neutral badge "In person" / "Online" / both, so the customer knows before choosing a time. Icons from lucide-react, tenant theme tokens only, no emojis, i18n keys in `types.ts`, `es.ts`, `en.ts` together (`t.booking.*`, `t.crm.products.*`, `t.apiErrors.modality_not_available`).

### WhatsApp bot (n8n, outside the repo)
- The chat workflow prompt has to use the per-service `modalityMode` from `bot/context` and handle the two new errors. The workflow is not in the repo and writes to n8n need explicit approval with a backup of the live workflow saved outside the repo (CLAUDE.md human gate). Plan: prepare the exact prompt text change, show it, and only then apply through `/n8n` or the MCP server. Until re-imported, the **server guard already prevents a wrong booking** (the old agent would get `modality_not_available` as data and tell the customer), so the order is safe: database, code, then n8n.
- Prompt rule to add (generic, no business wording): "Use the service's modalityMode. If it is IN_PERSON or ONLINE, do not ask and do not offer the other, but state it before booking so the customer is aware (for example 'this service is in person' or 'this service is online', with the address or the link note). Never present it as a choice. If ASK, ask once. Never tell the customer a service can be done in another mode than the one listed; if unsure, say the business will confirm."

- **Customer awareness (owner feedback, canvas fb-29, fb-30)**: when the mode is single, either because the service sets it or because the business does, nobody is asked, but the customer is always told. Bot: the agent says it before confirming the time and the booking reply repeats it. Web: the read-only line in the booking form and the badge on the product page (see above). `bot/context` and `bot/availability` return the mode per service so the sentence comes from data, not from the model's guess. The reminder already carries the address or the Meet link.

## Edge cases to cover

- Service `BOTH`, business `ONLINE`: the patient is asked (the service override wins).
- Business setting changed later (any direction): services with their own value are unaffected, services that inherit follow the new default; existing appointments are untouched.
- Existing appointments and old workflow calls without the new fields: unchanged paths (legacy two-argument `resolveModality`).
- Pet verticals (`VETERINARY`, `PET_CARE`) and tourism: same rule; tours are typically in person only. ECOMMERCE and non-bookable items: field hidden, no effect.
- The bot books for someone else (`patientPhone`): modality rule is about the service, not the person; no change.
- Reschedule from the bot or web keeps the service, so the stored modality stays valid.
- Free text from the business (service description) is never parsed to decide modality.

## Test plan (TDD, `npx tsx --test tests/*.test.ts`)

1. Pure matrix tests for `effectiveModes`, `modalityModeFor` and `resolveModality` (red first).
2. Route-level logic kept testable by injection like `reminder-run.ts`: booking an in-person-only service as ONLINE returns `modality_not_available` and creates nothing (no appointment, no calendar event, no Meet link).
3. `bot/context` product shape test (`modalityMode` per product).
4. `npx tsc --noEmit`, `npm run build` with zero errors (stop the dev server first), minimal-ui `audit.js` and `theme-colors.js` on touched files, check empty value / long value / dark mode / light and dark tenant colors / another vertical.
5. Manual check on a local tenant with `BOTH`: one service in person only, one online only, one default; web and a simulated bot call (local writes are production writes, so use a test service and say so first).

## Rollout order (human gates)

1. Approve this plan in the canvas.
2. Implement on a branch (tests first), code review, security scan (tenant-scoped input, new enum field).
3. Backup, then apply `23-product-modes/up.sql` to the real database with explicit approval. Database first, code after.
4. Merge (merge deploys), verify on production with a real business that a default service is unchanged.
5. Owner marks in-person-only services (tell the current clinic tenant first: its Planificacion Familiar and similar services).
6. Prepare the n8n prompt change, show it, back up the live workflow outside the repo, apply with approval.
7. Document: `docs/CHANGELOG.md`, `CLAUDE.md` (Product, Tenant `serviceModes`, bot section), `docs/DECISIONS-LEDGER.md`, `spec.md`, `docs/CODEMAPS/data.md`.

## Decisions taken

1. Keep both settings: business = default, service = override (confirmed by the owner).
2. Existing services inherit the business (no behavior change on deploy).
3. No conflict state: the service override always wins.
4. Column name `visitModes`.
5. The owner marks in-person-only services from the product form after deploy; nothing is changed by script in production. Tell the current clinic owner before the release.
