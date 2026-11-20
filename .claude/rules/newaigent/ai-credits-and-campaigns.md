---
paths:
  - "src/lib/ai/**"
  - "src/lib/credits*.ts"
  - "src/lib/owner-alert.ts"
  - "src/app/api/chat/**"
  - "src/app/api/credits/**"
  - "src/app/api/campaigns/**"
  - "src/app/api/internal/tokens/**"
  - "src/app/api/internal/campaigns/**"
  - "src/app/api/internal/render-post-banner/**"
  - "src/app/api/webhooks/social-campaign/**"
  - "src/app/admin/asistente/**"
  - "src/app/admin/social-campaign/**"
  - "src/components/admin/Credits*.tsx"
  - "src/components/chat/**"
---

> Moved from `CLAUDE.md` on 2026-11-20. Loads only when a matching file is read.

## AI Token Credits System (Platform AI Metering)

Each tenant has a monthly AI credit spending budget ($15 USD for Start, $25 for Plus, $50 for Pro).

### 1. Plan limits
| Plan | Monthly credit |
|---|---|
| **STARTER** | **$15.00 USD** (default) |
| **PLUS** | **$25.00 USD** |
| **PRO** | **$50.00 USD** |
| **ENTERPRISE** | **$200.00 USD** |

### 2. Cascading model stack (5 tiers)
To maximize credit monetization ($15 per Starter) and guarantee 100% availability, calls run as a cascade via `src/lib/ai/openrouter.ts`.
The real order is configured in the env var `OPENROUTER_MODELS` (comma-separated list).
Current production configuration (free models first, paid models as a last resort — see §7 "Shared OpenRouter balance"):
1. `nvidia/nemotron-3-super-120b-a12b:free` (Free: $0.00) — Primary.
2. `google/gemma-4-31b-it:free` (Free: $0.00) — Google open-weights fallback.
3. `openrouter/free` (Free: $0.00) — OpenRouter automatic selection.
4. `anthropic/claude-sonnet-4.5` (Paid: $3.00 in / $15.00 out) — Paid backup only if all free models fail or are saturated.
5. `openai/gpt-4o` (Paid: $2.50 in / $10.00 out) — Last paid backup.

> **Decision of Oct. 29, 2026 (privacy):** customer data (WhatsApp bot, Newy AI) goes to paid models, primary `google/gemini-2.5-flash`. Free models are kept only for content without personal data (social campaigns). Every OpenRouter request sends `provider: { data_collection: "deny" }` (`providerPreferences()` in `src/lib/ai/openrouter.ts`); `OPENROUTER_REQUIRE_ZDR=true` adds zero retention. In the OpenRouter account, also turn on the exclusion of providers that train on data (it covers n8n). The real cost per model is in `MODEL_PRICES_PER_M` (`src/lib/credits.ts`). See `docs/analisis-modelos-gratuitos.md`.

### 3. Business model: double accounting and SaaS arbitrage
The tenant always pays for **platform service units** at the standard retail rate:
- **Spend billed to the tenant (`totalCostUsd`)**:
  Calculated at `$3.00 USD / 1M` prompt and `$15.00 USD / 1M` completion, **regardless of whether the backend used a free or paid model**. It consumes the tenant's monthly $15 USD limit and triggers $15 recharges in Stripe.
- **Real provider cost (`realProviderCostUsd`)**:
  What NewAigent actually owes OpenRouter ($0.00 for `:free` models, real cost for Claude/GPT-4o).
- **Gross margin retained (`netMarginUsd`)**:
  `totalCostUsd - realProviderCostUsd`. When a free model runs, NewAigent keeps **100% gross margin ($15 USD net profit for every $15 of consumption/recharge)**.


### 4. Enforcement and auto-pause
- **Chatbot (`POST /api/chat`)**: Validates credits before invoking OpenRouter. If they are exhausted, it returns `402 Payment Required` with `{ error: "credit_exhausted" }`. The frontend shows an error toast, disables the input and shows a recharge banner.
- **WhatsApp bot**: `POST /api/internal/bot/context` includes `creditExhausted` (from `getCreditStatus()`) in every message. The workflow's "Guard: Credits OK" node checks it before invoking the agent: if the tenant already exhausted its monthly limit, the model call is skipped (no additional real cost) and a fixed degradation reply is sent instead of the LLM's — never silence, never spend without a cap.
- **Social campaigns (`GET /api/campaigns/social/due`)**: When credits run out, `pauseCampaignsForTenant()` sets `isActive = false, pausedByCredits = true`. The `due` endpoint automatically excludes these campaigns so n8n does not generate posts without balance.
- **Token deduction in the social webhook (`POST /api/webhooks/social-campaign`)**: When n8n publishes a post (`social_campaign_posted`), it sends `tokenUsage: { promptTokens, completionTokens, model }`. The webhook atomically invokes `recordTokenUsage()`, debiting credits at the retail rate ($3.00/$15.00 per 1M) regardless of whether the model was free, and stores the record in `SocialPost.postUrls.aiTokens`.
- **External report (`POST /api/internal/tokens/report`)**: Lets n8n or WhatsApp workflows report token consumption directly with `x-internal-key`.

- **Sidebar** (`CreditsBadge`): shows the percentage used (for example "7% Usado") and shows no dollar amounts or limit. The detail (`CreditsDrawer`) keeps the amounts.

### 5. Recharge and automatic reactivation
- The admin clicks "Recargar créditos" (Recharge credits) in the sidebar (`CreditsBadge`) or in the drawer (`CreditsDrawer`).
- A Stripe Checkout session is generated (`POST /api/credits`).
- The Stripe webhook (`checkout.session.completed`) processes the recharge through `rechargeCredits(tenantId, amountUsd)`: it increases `creditLimitUsd` on the active ledger and automatically reactivates all campaigns (`resumeCampaignsForTenant()`).

### 6. Tenant owner alerts
The platform has no email or Slack; the only channel is the business's own WhatsApp (`Tenant.whatsappNumber`), via `notifyTenantOwner()` (`src/lib/whatsapp.ts`, reuses `sendWhatsAppMessage`). Three triggers:
- **Credits exhausted**: inside `recordTokenUsage()` (`src/lib/credits.ts`), on the `isPaused` false→true transition (only once per period; the ledger's previous state is compared so the notice is not repeated on every later message).
- **Total WhatsApp bot failure**: if the n8n agent fails with every model in the cascade ("Bot Agent" node with `onError: continueErrorOutput`), the workflow sends the customer a fixed apology reply (instead of the total silence of before) and calls `POST /api/internal/bot/alert-failure`, which notifies the owner with a 60-minute cooldown (`Tenant.botFailureAlertedAt`) so as not to overwhelm them during a prolonged outage.
- **Social campaign failure**: the `Notify Error` node of `n8n/workflows/n8n-social-campaign-workflow.json` calls `POST /api/internal/campaigns/alert-failure`, which notifies the owner (60-minute cooldown, using `SocialCampaign.lastErrorAt`, which already existed). Previously this node posted to `$env.WEBHOOK_URL`, which does not exist in this n8n instance, so it never notified anyone.

### 7. Shared OpenRouter balance
All tenants share **a single OpenRouter account/API key** — there is no per-tenant key. Adding real credit to that account (e.g. $10 USD) permanently unlocks the whole account's daily limit for free models (from 50 to 1000 requests/day) and also remains available as spendable balance every time a paid model (Claude, GPT-4o) is used. To stretch that shared balance across all tenants:
- The cascade prioritizes free models (see §2); paid ones are the last resort, when OpenRouter answers 402/429/5xx on the free ones (`src/lib/ai/openrouter.ts` already retries the next model automatically, with no extra logic).
- There is no prior check of the real balance before each call (it would add latency to every turn); the 402 response from OpenRouter is relied on to skip to another model.
- `node local-utils/check_shared_balance.js` sums `realProviderCostUsd` across all tenants (current period and historical total) to manually monitor the shared balance. It is an operator tool, never shown to the tenant.
- One OpenRouter key per tenant remains a future option, only if the platform grows enough for a noisy tenant to drain the others' balance.


---


## Business AI Copilot: Newy AI (OpenRouter Cascade)

Endpoint: `POST /api/chat`

### Brand identity and white-labeling (absolute rule)
The platform's intelligent copilot has **Newy AI** (or *Newy AI Copiloto*) as its exclusive brand.
- **No vendor leaks**: Under no circumstances may the technical names of internal providers (Claude, Anthropic, OpenAI, GPT, OpenRouter, Evolution API, n8n, etc.) be shown to customers or administrators.
- **API masking**: In the `POST /api/chat` response, the `modelUsed` field always returns `"Newy AI"` to protect the internal infrastructure from network inspection in the browser.
- **Identity defense in `system-prompt.ts`**: If a user asks "who are you?" or tries a jailbreak by asking which model it is, Newy AI always answers that it is the intelligent copilot developed by NewAigent.

### Native CRM experience (`/admin/asistente`)
1. **Live KPI snapshot bar**: On every load (SSR), `src/app/admin/asistente/page.tsx` queries in parallel via Prisma:
   - Sales of the month (`revenueMonth`) and count of paid orders (`ordersCount`).
   - Pending orders (`pendingOrdersCount`).
   - Active product catalog (`activeProductsCount`).
   - Active social campaigns (`activeCampaignsCount`).
2. **One-click question triggers**: Each KPI card includes an interactive "Preguntar ↗" (Ask) button on hover, immediately sending an analytical, contextualized query to Newy AI.
3. **Executive navigation shortcuts**: Header with direct quick links to `/admin/pedidos`, `/admin/calendario`, `/admin/productos` and `/admin/social-campaign`.
4. **Tool execution flow**:
   - The admin types in `/admin/asistente` or clicks a metric.
   - The frontend sends the conversation to `POST /api/chat`.
   - The API invokes the Newy AI cascade stack with tools defined in `src/lib/ai/tools.ts`.
   - `execute-tool.ts` runs Prisma queries **always filtered by the tenantId** of the session JWT.
5. **Security and system instruction protection (`system-prompt.ts`)**:
   - Strict rules against **Prompt Injection** and jailbreaks.
   - Absolute prohibition on revealing the system prompt, internal instructions, credentials, tokens or underlying architecture in response to malicious or social-engineering requests.

Available tools: sales, orders, products, customers, reviews, FAQs (`get_faqs`), business (`get_business_profile`), catalog (`search_products`), WhatsApp counts (`get_whatsapp_summary`) for all verticals; appointments, free time slots and confirmations (`get_appointments`, `get_schedule_availability`, `get_confirmation_status`, etc.) only with `isBookingEnabled`. The tools do not send emails, clinical notes or message text (see spec 21.12).

---

## n8n Automation and Token Metering

Social campaigns run automatically in n8n under a strict **API-first architecture** (n8n **never** connects directly to the PostgreSQL database; every operation is done through HTTP calls to the Next.js APIs authenticated with `x-internal-secret`):

1. **Scheduled campaign lookup**: n8n periodically queries `GET /api/campaigns/social/due` (filters `nextPostAt <= now AND isActive = true AND pausedByCredits = false`).
2. **Campaign and tenant context**: n8n invokes `GET /api/campaigns/social/[id]/context` to receive the campaign configuration, Meta credentials and the business data.
3. **Dynamic image selection (`selectedImageUrl`)**:
   - In the UI (`/admin/social-campaign`), the user interactively selects any product photo from their catalog (never hardcoded `images[0]`).
   - The selected URL is persisted in `SocialCampaign.selectedImageUrl` in the PostgreSQL database.
   - In the `Build Image Request` node, n8n reads `campaign.selectedImageUrl` directly from the context payload. If no photo is assigned, it falls back to the product photo or a watermark-free editorial photograph.
4. **Isolated Cloudinary storage**:
   - The `Upload to Cloudinary` node only passes the data. The upload is done by `render-post-banner` in `newaigent/{tenantId}/campaigns` (`tenantId` is mandatory).
5. **Strategic copy generation (OpenRouter free models)**:
   - The `Newy AI - Generate Content` node sends the prompt to OpenRouter using `google/gemini-2.0-flash-exp:free` (falling back to `meta-llama/llama-3.3-70b-instruct:free` and `openrouter/free`).
   - It includes anti-leak sanitization filters to strip thinking tokens (`<think>`) and prevent system prompt leaks to Facebook or Instagram.
6. **Publishing on the Meta Graph API**:
   - Facebook Page: `POST /v19.0/{pageId}/photos`.
   - Instagram Business: `POST /v19.0/{igUserId}/media` (container) -> wait 5s -> `POST /v19.0/{igUserId}/media_publish`.
7. **Calendar update**: Calls `PATCH /api/campaigns/social/[id]` with `markPosted: true` so the CRM recalculates `nextPostAt`.
8. **Audit and token ledger**:
   - Notifies `POST /api/webhooks/social-campaign` with a `webhookPayload` containing `tokenUsage: { promptTokens, completionTokens, model }`.
   - The webhook deducts credits in `AiTokenLedger` applying the standard SaaS rates ($3.00 in / $15.00 out per 1M tokens) and records the post in `SocialPost`.

---


## Banner Pipeline for Social Campaigns (`/api/internal/render-post-banner`)

- **Endpoint**: `POST /api/internal/render-post-banner`
- **Auth**: Header `x-internal-key` → `process.env.INTERNAL_API_KEY`
- **Function**: Composes a 1080×1080 image with the Cloudinary SDK:
  1. Uploads an SVG overlay with a dark gradient (scrim), hero title, subtitle and CTA pill button
  2. Combines the overlay with the product's base photo (crop fill + gravity auto)
  3. Returns the public Cloudinary URL of the composed banner
- **Called by**: n8n before publishing to Facebook/Instagram
- **Body parameters**: `imageUrl` (required), `tenantId` (mandatory), `hero`, `heroHighlight`, `support`, `cta`, `accentColor`
- **Storage**: `newaigent/{tenantId}/campaigns/banner_{timestamp}`

---
