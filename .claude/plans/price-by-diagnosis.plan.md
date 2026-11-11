# Price that depends on the diagnosis ("from" price and "on request")

Status (2026-11-10): analysis and plan, revised after canvas feedback fb-32, waiting for approval in the canvas. No code written.

## Revision after feedback (fb-32)

The owner's example: "how much does an injury cost?" The service **Injury** has no price; **General consultation** has one. The bot answers: the price is defined at the consultation, book a general consultation. The customer checks the price with the doctor in the appointment.

What this changes in the plan:
- The core of the feature is now the **unpriced service with a pointer to the service that gets booked**. New nullable field `Product.assessmentProductId`: "the price is defined at this service". Injury shows "Price after assessment" and a button "Book General consultation" that goes to that service. The bot says the same and books the pointed service, never the unpriced one.
- `ON_REQUEST` is the mode that carries it; `FROM` stays as the cheap second mode (same helper) and can be cut if you do not need it.
- "D" in the options table (record the final price per appointment) is **kept as phase 2**: the example does not need it, because nothing is charged at booking. Confirm in the canvas if you meant it to be built now.

## Request

A customer (a business using the platform) says the price of some services is not fixed: it depends on the diagnosis made in the consultation. Question: is it valid and applicable, and what does it take?

## Verdict

**Valid and applicable.** It is a normal case in health, veterinary, tourism and repair-type services. It is cheap to build because **no money is charged when an appointment is booked today** (see below), so this is a display and messaging problem, not a payments problem. The real risk is not the form: it is the **bot quoting a number as if it were final**, and the **checkout charging a "from" price**. Both are closed on the server, not only in the wording.

## What the code does today (verified)

- `Product.price` is a required `Float`, validated `positive` (`src/lib/validations/index.ts:40`). There is no way to say "it depends".
- A booked service **charges nothing**. `Appointment` has no price field; every screen reads the live `product.price`. Orders and checkout only run for items in the cart (`api/checkout`, `api/orders` sum `product.price * quantity` from the database).
- The price is shown or quoted in 12 places, each formatting it on its own:
  - Storefront: `ProductCard`, product page, `BookingFlow` (two spots), `mis-citas` (`CustomerAppointmentsList`), cart and checkout.
  - CRM: `/admin/citas` (`page.tsx:634`), Newy AI (`execute-tool.ts` lines 190, 237, 374, and `system-prompt.ts:19`).
  - Bot and automation: `bot/context` (`route.ts:101`, sent to the WhatsApp agent as `price` and `currency`), `internal/tenant-context`, social campaign context and the Facebook products route (a campaign post can advertise a price).
  - Catalog sort by price (`(public)/productos/page.tsx:20`).
- Weakness found on the way (not caused by this plan): because appointments read the live product price, editing a price later changes the price shown on **past** appointments.

## Options considered

| Option | Customer sees | Verdict |
|---|---|---|
| A. Price mode: fixed, from, on request | "$500", "From $500", "Price after assessment" | **Recommended.** Covers the stated need, small. |
| B. A free-text note only ("price may vary") | Price stays a number, a line of text next to it | Rejected. The bot and the number still read as final. |
| C. Range, min and max | "$500 to $900" | Not in the first version. A natural next step; asked as a decision below. |
| D. Final price recorded per appointment after the visit | Not shown to the customer before | Phase 2, separate decision (below). |

Rejected for all: parsing the service name or description to guess it varies (breaks the multi-tenant rule: no parsing of free text).

## Design (option A)

### Data (additive, `prisma/sql/24-product-price-mode/up.sql` and `down.sql`)
- New enum `PriceMode` = `FIXED`, `FROM`, `ON_REQUEST`.
- `products.priceMode PriceMode NOT NULL DEFAULT 'FIXED'`. Every existing product keeps today's behavior, no surprises on deploy.
- `price` stays a non-null `Float`. For `ON_REQUEST` it is stored as `0` and never shown. Reason: making it nullable would touch every `product.price` reader (38 files). The cost is that a stray `0` could leak, so every reader goes through one helper (below) and the money paths refuse non-fixed items.
- `products.assessmentProductId TEXT NULL`: the service to book to learn the price (General consultation in the example). Plain column, no foreign key: it is checked when saved (same tenant, active, bookable, `FIXED`, not the product itself) and again when read, so a target that is later deleted, hidden, or turned into a non-fixed price silently stops redirecting instead of breaking a page. Only meaningful with `ON_REQUEST`; ignored otherwise.
- Additive, so old code ignores the column: database first, code after. Follow "Schema changes" in CLAUDE.md: verified backup, local check, explicit approval before applying, no `db:push`. `down.sql` drops the column and the enum.

### One pure helper (`src/lib/price-display.ts`, tests first)
- `priceDisplay({ price, priceMode }, locale)` returns `{ kind, amount, text, needsFootnote }`:
  - FIXED: "$500.00", no footnote.
  - FROM: "From $500.00" (Spanish: "Desde"), footnote.
  - ON_REQUEST: "Price after assessment" (Spanish: "Precio según valoración"), footnote, **no amount at all**.
- `priceTextForBot(product, language)`: the same sentence for the agent in the business `messageLanguage` (es or en), including the footnote.
- `isPurchasable(product)`: true only for `FIXED`.
- Wording is neutral for every vertical (assessment, not "diagnosis"), in `t.*` for es and en; no business-specific text.
- Every place in the list above stops calling `formatPrice(product.price)` directly and uses the helper. This is the actual work.

### Where it applies
- **Every item type** (revised after the SaaS check below). The selector is in the product form for any item. The rule that keeps it safe is not the type but the guard: a non-fixed item can never be added to the cart or charged.
- **Product form** (inside the same group as visible, booking, delivery): selector "How the price is set" with the three options, the price field becomes "Starting price" for FROM and is hidden for ON_REQUEST. Switching back to FIXED requires a positive price (existing validation).
- **Storefront**: card, product page and booking header show the label. The booking confirm step shows the footnote ("The final price is confirmed after the assessment") next to the price, so the customer accepts it knowingly. `mis-citas` and `/admin/citas` show the label.
- **Unpriced service with a target** (the injury example): the product form adds a selector "Book this service to know the price" listing the tenant's priced, bookable services. When a target is set, the unpriced service itself is not booked (no date, no slots): its product page shows "Price after assessment" and the button "Book {target name}" linking to `/agendar/<target slug>`. With no target and booking on, the service is booked as usual and shows the label plus the footnote (a site inspection whose price is set on the visit). With no target and booking off, the page shows the label and a button "Ask about the price" that opens the business WhatsApp with a prefilled message (the booking page already builds this link, `BookingFlow.tsx:209`; `Tenant.whatsappNumber` is required, so every business has one).
- **Catalog sort by price**: `ON_REQUEST` goes last in both directions; `FROM` sorts by its starting price.

### Server guards (the part that is not wording)
- **Checkout and orders** (`api/checkout`, `api/orders`): reject any item whose `priceMode` is not `FIXED` with `price_not_fixed`. A "from" price is never charged as if it were final.
- **Bot context**: for `ON_REQUEST` send `price: null` (the agent has no number to say), plus `priceMode` and `priceText` for every service. For `FROM` the number is the floor; the prompt tells the agent to say `priceText` verbatim. This is a guide, not a guarantee (same limit as the other prompt rules), which is why the number is removed when there is none.
- **Bot context** also returns, for an unpriced service with a valid target, `bookInstead: { id, name }`. `bot/book` on the unpriced service already answers `not_bookable`; the message now says the price is defined at the target service and to offer booking `{name}` (a server-side nudge on top of the prompt). Example conversation: "how much is an injury treatment?" -> "The price is defined at the consultation. Do you want to book a General consultation?" -> the agent books the target id.
- **Newy AI tools and system prompt**, **tenant-context**, **social campaign context** and the **Facebook products route** send `priceText` instead of a bare number, so a campaign post never advertises "$500" for a from-priced service.

### n8n chat workflow (outside the repo)
- Prompt rule, generic: "Use the service's `priceText` with the same figure and meaning (you may translate it to the customer's language). Never estimate, never invent or round a price, never say a from-price is the final cost. If `priceMode` is ON_REQUEST there is no price: say it is defined at the assessment."
- This prompt edit goes in the **same write** as the pending visit-modality prompt edit: one backup, one approval. Not before the code is deployed (the agent would see `priceText` it does not know yet; harmless, but there is no point).

## SaaS check: other businesses this touches (added after fb-33)

The feature must work as a rule for any tenant, not only the clinic in the example. Scenarios checked against the code:

| Business | Real case | How the plan covers it | Gap or change |
|---|---|---|---|
| Health, wellness | Injury, procedure, specialist care priced after the exam | Unpriced service pointing to the consultation | None (the example) |
| Veterinary, pet care | Price by species, size, weight; grooming or surgery after an exam | `FROM` ("From $300"), or on request pointing to an evaluation visit | None |
| Tourism, travel | Custom itinerary, price per group or season | On request, pointing to a planning call, or the WhatsApp button | None |
| Services (repair, cleaning, contractors, legal, accounting) | Quote after an on-site inspection | On request, bookable with no target (the inspection is the booking) or pointing to it | None |
| Online store (ECOMMERCE, GENERAL) | Made-to-order, wholesale, "contact for price" | Any item type can be on request; no cart button; "Ask about the price" opens WhatsApp | Changed: the plan was services only, now every type (the guard makes it safe) |
| Restaurants, events, catering | Per-event quote | On request plus the WhatsApp button | None |
| Free first assessment | "Free evaluation" as the target service | Needs a price of 0, and the validation says price must be positive | Decision 5 below |
| Businesses outside Mexico | Other currency | The helper takes a currency, but the whole platform hardcodes MXN today (bot context, checkout, system prompt, campaign page) | Out of scope: no per-tenant currency exists. The helper must not make it worse |
| Customer writes in English, bot text in Spanish | `priceText` language | `priceText` follows the business `messageLanguage` (es or en); the agent may translate for the customer but must keep the figure and the meaning | Prompt rule reworded from "verbatim" to "same figure and meaning" |

Other places it reaches, checked:
- **Customers with a cart already saved in the browser** (Zustand): an item added at a fixed price whose owner later sets "on request" is refused at checkout with `price_not_fixed`. That code needs a plain message in `apiErrors` (es and en), shown in the cart, so the customer is not left with a silent failure.
- **Social campaigns (n8n workflow outside the repo)**: the context sends `price`; a post generated for an on-request service must not print a number, and a `null` could print as the word "null" if the workflow builds the text with the price. Before deploy, inspect the live workflow with `/n8n` (read-only). If it interpolates the price, change it in the same approved n8n write as the chat prompt. The campaign admin page (`social-campaign/page.tsx:701`) also formats the price directly and moves to the helper.
- **Newy AI**: revenue and KPIs come from orders only, so no number is wrong; its service list and appointment list show the label instead of a bare price.
- **Calendar events, reminders and confirmations**: none include the price, so nothing to change (checked in `google-calendar`, `microsoft-calendar`, `reminder-messages`).
- **SEO**: the storefront has no structured price data (no `offers`), so no markup to keep honest.
- **STAFF role** cannot open products, so it never sees the selector.
- **Plans and quotas**: no plan limit involved.

## Edge cases

- Existing services: all `FIXED`, nothing changes.
- A service switched to `ON_REQUEST` while it has future appointments: they keep working; their screens now show the label.
- `ON_REQUEST` with price `0` must never reach a sum, a sort key, a post or the bot: covered by the helper, the guards and tests.
- A non-bookable service with `FROM` is information only: it shows "From $X" and still has no cart button when it is a service without purchase (same rule as today; the guard covers the cart path anyway).
- Currency, locale and the empty or very long value: unchanged, the helper reuses `formatPrice`.
- Dark mode and very light or dark tenant colors: the label uses the existing price text style; the footnote is one neutral gray line.

## Test plan (TDD, no database needed)

- `tests/price-display.test.ts`: the three modes in both languages, no amount for `ON_REQUEST`, footnote flags, `isPurchasable`, the bot sentence.
- A pure `partitionPurchasable(items)` used by checkout and orders, tested with fixed, from and on-request items.
- Product validation: price positive unless `ON_REQUEST`.
- Pure `resolveAssessmentTarget(product, candidates)`: returns the target only when it is the same tenant, active, bookable, fixed-price and not the product itself; otherwise null (deleted, hidden, or changed target never redirects). Also tested: `bookInstead` is absent when the mode is not `ON_REQUEST`.
- Sort helper: `ON_REQUEST` last in both directions.
- Then `npx tsc --noEmit`, the full suite, `minimal-ui` audits and a browser check on a phone width and dark mode.

## Rollout

1. Own branch off `main` (after the visit-modes PR merges, or stacked on it; the SQL folders are independent: 23 and 24).
2. Apply `24-product-price-mode/up.sql` to the real database (backup, approval), then deploy the code (merge deploys).
3. Owner marks the services (the customer sets "From" or "On request" in the product form).
4. One n8n prompt write covering visit modes and price (backup outside the repo, approval first).
5. CHANGELOG, CLAUDE.md (`Product.priceMode`), DECISIONS-LEDGER.

## Decisions needed from you

1. **Range**: do they also want "$500 to $900"? Recommendation: not now; add `priceMax` later if they ask. It changes the label and one more field, nothing else.
2. **Final price per visit (phase 2)** (your "D"; the injury example does not need it, so I kept it out of this build. Say so in the canvas if you want it now): should the professional record the real amount in `/admin/citas` when marking the visit attended (`Appointment.finalPrice`)? It fixes the "past appointments change when a price is edited" weakness and is the base for any future revenue report. Recommendation: separate ticket, ask the customer first.
3. **Tenant-written note**: a short free-text line next to the price ("includes the first review") on top of the neutral footnote? Recommendation: no, the neutral footnote is enough for the first version.
4. **Free services** (from the SaaS check): many businesses offer a free first assessment, and the target service of the example could be exactly that. Today a service cannot have price 0. Recommendation (adopted, with the price field starting empty so a free service is always a typed 0, never a forgotten price): allow price 0 for a fixed-price service, shown as "Free", and keep it out of the cart and checkout (`isPurchasable` requires a price above 0). Without it, those businesses must fake a $1 price.
5. **Any item type, not only services**: I widened it (table above) because the guard makes it safe and online stores ask for "contact for price". Say if you prefer the narrower first version, services only.
6. **Capability catalog**: this is a product field, not a tool, so I would not add it to `src/lib/capabilities.ts` and it is open to every plan. Say so if you want it gated.

## Risks

- The bot is guided, not forced: a model can still paraphrase "from $500" as "$500". Mitigations: no number for `ON_REQUEST`, verbatim `priceText`, and the footnote at booking. The residual risk is the same as every other prompt rule in the bot.
- 12 display points means a missed spot shows a bare number. Mitigation: grep for direct `product.price` reads before closing, and a test that lists the readers is not practical; the review step covers it.
- Legal wording about price disclosure is the business owner's responsibility; the footnote is on purpose visible at booking.
