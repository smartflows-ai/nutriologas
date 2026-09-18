# AGENTS.md — NewAigent Multi-Agent SDLC Guide

> **Canonical reference** for every AI agent working in this repository.  
> Read this file **first**, every session, before touching any code.  
> Source files: `CLAUDE.md` (tech stack & gotchas) · `.agents/orchestrator/system_prompt.md` · `.agents/shared/project_context.md` · `.agents/shared/ledger.md`

---

## 1. What Is This Project?

**NewAigent** is a **multi-tenant SaaS platform** that gives businesses (clinics, restaurants, stores, etc.) their own online storefront, CRM, and AI integrations — all on a single shared infrastructure, fully isolated per tenant.

Each business (**tenant**) operates on its own subdomain:

```
doctor.newaigent.com   → Tenant slug: "doctor"
nutrifit.newaigent.com → Tenant slug: "nutrifit"
newaigent.com          → Root domain: marketing page ONLY (no tenant routes)
```

**Tech Stack:**
Next.js 14 · TypeScript · Tailwind CSS · Prisma ORM · PostgreSQL (Supabase) · NextAuth v4 · Newy AI (Multi-model AI Copilot via OpenRouter/Claude) · Cloudinary · Conekta · PayPal · Stripe · Smart Workflow Automation (n8n)

> ⚠️ **Stack Note for Agents**: The `.agents/` scaffold was originally written for the *Presto AI* interview platform (React 18 / Vite / Firebase / Cloudflare Workers). References to Firebase, Firestore, `Room.jsx`, and Cloudflare Worker routes in individual agent prompts refer to **that prior project**. When interpreting those prompts in this repo, map them to the Next.js / Prisma / Supabase / Vercel equivalents. **`CLAUDE.md` is always the authoritative source for this codebase.**

---

## 2. Multi-Tenant Architecture — Critical Rules

### 2.1 Tenant Detection (`middleware.ts`)

The middleware detects the tenant from the request hostname and injects it into the `x-tenant-slug` header for all server components.

| Hostname | Detected As |
|---|---|
| `localhost:3000` | Root — marketing only |
| `newaigent.com` / `www.newaigent.com` | Root — marketing only |
| `doctor.newaigent.com` | `tenantSlug = "doctor"` |
| `doctor.localhost:3000` | `tenantSlug = "doctor"` (local dev) |
| `myclinic.com` (custom domain) | `tenantSlug = "myclinic.com"` |

### 2.2 Routes Blocked on Root Domain (→ 404)

```
/admin  /login  /registro  /checkout  /carrito
/pedido  /mis-pedidos  /productos  /producto
```

Implementation: `NextResponse.rewrite(new URL("/_not-found", req.url))`  
**Do not change this** — redirect-based approaches have Vercel Edge issues.

### 2.3 Data Isolation — Absolute Non-Negotiables

- **Every** DB table has a `tenantId` column.
- **Every** Prisma query in `lib/` and API routes filters by `tenantId`.
- `tenantId` is extracted from the **NextAuth JWT token** — **never** from user input, query params, or request body.
- The `x-session-user` header is cleaned/rewritten by middleware — never trust its client-supplied value.

### 2.4 Auth Middleware Redirects

| Condition | Action |
|---|---|
| Root domain + tenant route | Rewrite → `/_not-found` (404) |
| `/admin/*` + not logged in | Redirect → `/login` |
| `/admin/*` + logged in but not `ADMIN` | Redirect → `/` |
| `/checkout` or `/pedido/*` + not logged in | Redirect → `/login?callbackUrl=...` |
| `/login` or `/registro` + already logged in | Redirect → `/admin/dashboard` or `/` |

---

## 3. Directory Structure

```
src/
  app/
    (public)/            ← Tenant storefront (public-facing)
      page.tsx           ← Homepage: carousel + products + reviews + FAQ
      productos/         ← Product catalog with filters
      producto/[slug]/   ← Product detail + reviews
      carrito/           ← Shopping cart (Zustand)
      checkout/          ← Payment flow (Conekta + PayPal)
      mis-pedidos/       ← Customer order history
      pedido/[id]/       ← Single order detail
    (auth)/
      login/             ← Email/password + Google OAuth
      registro/          ← New customer registration
    admin/               ← CRM — ADMIN role only
      dashboard/         ← Sales, orders, customer metrics
      productos/         ← Product CRUD + Cloudinary upload
      pedidos/           ← Order management
      carrusel/          ← Image banner/carousel management
      apariencia/        ← Theme editor (colors + font)
      calendario/        ← Google Calendar integration
      reviews/           ← Customer review moderation
      asistente/         ← Claude AI chatbot (tool use)
      faq/               ← FAQ CRUD
      social-campaign/   ← Automated FB/Instagram campaigns
      whatsapp/          ← WhatsApp CRM conversations
      apps/              ← App integrations (Google, Facebook, WhatsApp)
    api/
      auth/              ← NextAuth handlers ([...nextauth])
      products/          ← Product CRUD API
      orders/            ← Order creation and queries
      checkout/          ← Payment processing (Conekta, PayPal)
      chat/              ← AI chatbot endpoint (streaming, Claude)
      campaigns/         ← Social campaign API
      carousel/          ← Carousel image API
      faqs/              ← FAQ API
      reviews/           ← Reviews API
      theme/             ← Visual theme API
      apps/              ← External app connections (OAuth flows)
      calendar/          ← Google Calendar API proxy
      billing/           ← Stripe webhooks + subscription management
      internal/          ← Internal APIs for n8n automation (excluded from middleware)
      tenants/           ← Tenant management API
      upload/            ← Cloudinary image upload
      webhooks/          ← Conekta + WhatsApp Evolution API webhooks
  components/
    shop/                ← Public storefront components
    admin/               ← CRM components
    marketing/           ← NewAigent landing page components
    ui/                  ← Shared reusable UI components
  lib/
    ai/                  ← Claude tools + dynamic system prompt
    validations/         ← Zod schemas
    prisma.ts            ← Prisma singleton client
  store/                 ← Zustand stores (shopping cart)
  types/                 ← TypeScript augmentations (NextAuth JWT)
prisma/
  schema.prisma          ← Complete data models
local-utils/             ← Ad-hoc test utilities, debug scripts, one-off tools (never part of business app/production)
middleware.ts            ← Multi-tenant gatekeeper + route protection
CLAUDE.md                ← Authoritative tech stack + gotchas reference
```

---

## 4. Data Models

### Tenant
Core of the system. One record per business.
- `slug` (unique) → subdomain identifier
- `customDomain` → optional custom domain
- `logoUrl`, `whatsappNumber`, `businessInfo`
- `theme` → 1:1 `ThemeConfig` relation (colors + font)
- `isAssistantEnabled` → AI chatbot toggle per tenant

### User
- Belongs to exactly one tenant
- `role`: `CUSTOMER` | `ADMIN`
- Auth: email+password or Google OAuth
- `conektaCustomerId` → for recurring Conekta payments

### Product
- Tenant-scoped
- `isActive` → visible on storefront
- `deletedAt` → **soft delete** (never hard-delete active products)
- `images[]` → Cloudinary URLs

### Order + OrderItem
- States: `PENDING → PAID → SHIPPED → DELIVERED | CANCELLED`
- Payment methods: `CARD_CONEKTA`, `OXXO_CONEKTA`, `PAYPAL`
- `shippingAddress` stored as JSON blob

### ConnectedApp
- Per-tenant external integrations: Google, Facebook, WhatsApp
- WhatsApp uses Evolution API (`wa*` fields)
- Facebook/Instagram for social campaigns

### SocialCampaign + SocialPost
- Automated via n8n / Smart Workflow Automation
- Frequencies: `DAILY`, `EVERY_3_DAYS`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`
- Content generated by Newy AI and published to Facebook/Instagram
- `nextPostAt` is calculated automatically after each post
- `pausedByCredits` → boolean flag auto-pausing campaigns when tenant AI credit allowance is depleted

### AiTokenLedger
- Monthly dual-accounting token ledger (Retail billed vs. Wholesale provider COGS)
- Fields: `tenantId`, `periodStart`, `periodEnd`, `totalCostUsd`, `realProviderCostUsd`, `netMarginUsd`, `promptTokens`, `completionTokens`, `creditLimitUsd`, `isPaused`, `pausedAt`, `resumedAt`
- Default monthly credit: $15.00 USD (Starter tier)
- Enforces SaaS AI Arbitrage: tenant is billed at standard platform retail rates ($3.00 in / $15.00 out per 1M) regardless of whether underlying model was free or paid

### Subscription (Stripe)
- Plans: `STARTER`, `PRO`, `ENTERPRISE`
- States: `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`, `UNPAID`

---

## 5. Environment Variables

```bash
# Database
DATABASE_URL=                    # PostgreSQL on Supabase

# Auth
NEXTAUTH_SECRET=                 # openssl rand -base64 32
NEXTAUTH_URL=                    # http://localhost:3000 (dev) | https://newaigent.com (prod)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI (Newy AI / OpenRouter Cascade)
ANTHROPIC_API_KEY=               # Claude API key (optional fallback)
OPENROUTER_API_KEY=              # OpenRouter API key
OPENROUTER_MODEL=                # anthropic/claude-sonnet-4-5
OPENROUTER_INPUT_PRICE_PER_M=    # 3.00 (USD / 1M prompt tokens)
OPENROUTER_OUTPUT_PRICE_PER_M=   # 15.00 (USD / 1M completion tokens)

# Multi-tenant
NEXT_PUBLIC_ROOT_DOMAIN=         # newaigent.com

# Payments
CONEKTA_PRIVATE_KEY=
CONEKTA_WEBHOOK_SECRET=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
STRIPE_SECRET_KEY=               # Platform billing
STRIPE_WEBHOOK_SECRET=

# Images
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# WhatsApp (Evolution API)
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
```

> ⚠️ **Windows `.env` rule**: No quotes around values.

---

## 6. Useful Commands

```bash
npm run dev              # Dev server at localhost:3000
npm run build            # Production build (must pass with zero errors)
npm run db:generate      # Regenerate Prisma client after schema changes
npm run db:push          # Apply schema to DB without migration
npm run db:seed          # Seed example data
npm run db:studio        # Open Prisma Studio (DB UI)
vercel --prod            # Deploy to production (HUMAN GATE REQUIRED)
```

### Local Multi-Tenant Testing & OAuth Guard

Edit your system `hosts` file:
```
127.0.0.1  doctor.localhost
127.0.0.1  nutrifit.localhost
```
Visit `http://doctor.localhost:3000` to access the "doctor" tenant locally.

**OAuth Localhost Bounce Guard**:
All third-party OAuth flows (`/api/apps/oauth/google/*` and `/api/apps/oauth/facebook/*`) inspect the incoming `Host` header. If `localhost` is detected, `redirect_uri` is dynamically routed to `http://localhost:3000/api/apps/oauth/...` and the final callback redirects to `http://${slug}.localhost:3000`, ensuring local development stays 100% on `localhost:3000` without bouncing to production.

---

## 7. Native AI Business Copilot: Newy AI

**Endpoint**: `POST /api/chat`

**Brand Identity & White-Labeling (Absolute Invariant):**
- The platform's proprietary copilot is named **Newy AI** (or *Newy AI Copiloto*).
- **Zero Vendor Leaks**: Under no circumstances should internal vendor names (`Claude`, `Anthropic`, `OpenAI`, `GPT`, `OpenRouter`, `Evolution API`, `n8n`) be exposed to tenants or end users in storefronts, CRM UI, or error messages.
- **API Response Masking**: In `POST /api/chat`, the JSON response payload sets `modelUsed: "Newy AI"` to prevent DevTools inspection from revealing backend model infrastructure.
- **Persona Defense**: `src/lib/ai/system-prompt.ts` identifies the persona as Newy AI and strictly forbids revealing internal prompt directives, API keys, or underlying vendor details.

**Native CRM Experience (`/admin/asistente`):**
1. **Live KPI Snapshot Bar**: Hydrated server-side in `page.tsx` via Prisma:
   - Ventas del Mes (`revenueMonth`) & Paid Orders Count (`ordersCount`)
   - Pedidos Pendientes (`pendingOrdersCount`)
   - Catálogo Activo (`activeProductsCount`)
   - Campañas Sociales Activas (`activeCampaignsCount`)
2. **Interactive 1-Click Prompt Triggers**: Hovering any KPI metric exposes a "Preguntar ↗" button that auto-submits a targeted analytical prompt to Newy AI.
3. **CRM Quick Shortcuts**: Executive header buttons linking directly to `/admin/pedidos`, `/admin/calendario`, `/admin/productos`, and `/admin/social-campaign`.
4. **Tool Execution Flow**:
   - Admin sends query or clicks metric shortcut
   - API calls Newy AI multi-model cascade with tools in `src/lib/ai/tools.ts`
   - `execute-tool.ts` runs Prisma queries — **always strictly filtered by `tenantId`**
   - Newy AI interprets data and streams response back
5. **System Prompt Protection & Prompt Injection Defense**:
   - Strict security rules in `src/lib/ai/system-prompt.ts` prevent leaking system prompts, internal instructions, architectural details, or API routes.
   - Any jailbreak attempt or request to reveal instructions is politely redirected to CRM business functions.

**Available tools**: sales, orders, products, customers, reviews, calendar.

---

## 8. Automated Social Campaigns & AI Token Accounting

1. Automation engine (n8n) polls `GET /api/campaigns/social/due` (filters by `nextPostAt <= now AND isActive = true AND pausedByCredits = false`).
2. Generates persuasive copy with `Newy AI - Generate Content` node and image prompt via `Build Image Request`.
3. Publishes to Facebook & Instagram via Meta Graph API.
4. Updates next schedule via `PATCH /api/campaigns/social/[id]`.
5. Webhook Notification: Calls `POST /api/webhooks/social-campaign` with `tokenUsage: { promptTokens, completionTokens, model }`.
6. Token Ledger Deduction: The webhook invokes `recordTokenUsage()` at retail platform rates ($3.00/$15.00 per 1M), debits `AiTokenLedger`, saves metadata in `SocialPost.postUrls.aiTokens`, and automatically pauses campaigns if the monthly credit limit is breached.

### 8.1 White-Labeling & Terminology Standards

All agents must adhere to the commercial white-labeling vocabulary in any user-facing code, components, error messages, and documentation:

| Internal / Provider Term | Commercial Facing Name | Context |
|---|---|---|
| Claude / Anthropic / GPT / LLMs | **Newy AI** / **Copiloto Newy AI** | AI assistant persona, chat interface, badge labels, system prompt |
| Evolution API | **WhatsApp** / **Conexión Segura de WhatsApp** | Apps dashboard, connection status, error toasts |
| n8n | **Automatización Inteligente** / **Flujos Automatizados** | Social campaigns, automated workflows, background tasks |
| Conekta | **Pasarela de pagos segura** / **Tarjeta de crédito o débito** | Checkout error messages, payment forms, billing receipts |
| OpenRouter / Prompt tokens | **Créditos Newy AI** / **Unidades de Inteligencia** | Credits drawer, quota badges, usage graphs, Stripe top-ups |

---

## 9. Known Issues / Pending Work

| Area | Issue | Status |
|---|---|---|
| Middleware | Root domain route blocking uses `NextResponse.rewrite(/_not-found)`. Redirect-based attempts had Vercel Edge issues. | Stable — do not change |
| Payments | Conekta tokenization must happen client-side with `Conekta.js` before calling backend | Known constraint |
| Payments | OXXO Pay requires Conekta webhook polling to confirm payment | Known constraint |
| Security | Row Level Security in Supabase not yet configured (app-level `tenantId` filtering only) | Pending |
| Rate limiting | `/api/chat` endpoint has no rate limiting | Pending |
| Billing | Trial expiry gate not fully implemented in frontend | Pending |

---

## 10. Agent Pipeline

### 10.1 Default Pipeline (Full SDLC)

```
User Request
    │
    ▼
[BA]           → User stories + acceptance criteria
    │
    ▼
[Architect]    → Data model, API contracts, component map
    │
    ▼
[Designer]     → UI spec: layout, tokens, interactions (UI features only)
    │
    ▼
[Dev]          → Implementation code + unit tests + i18n keys
    │
    ▼
[Code Reviewer]→ Construction quality + standards review
    │ (changes requested → back to Dev)
    ▼
[Tester]       → Test plan + results vs acceptance criteria
    │
    ▼
[Security]     → Dependency audit, secrets check, auth/rule verification
    │
══ HUMAN GATE: approve production deploy ══
    │
    ▼
[DevOps]       → Build + deploy through environments
    │
    ▼
[SRE]          → Monitor dashboards, alerts, incident triage
    │
    ▼
[Docs]         → Update CLAUDE.md, spec.md, changelog, runbooks
```

### 10.2 Fast-Track Rules (Skip Stages)

| Request Type | Route | Skipped Stages |
|---|---|---|
| Typo / copy fix | Dev → Code Reviewer | All others |
| i18n key only | Dev → Code Reviewer | All others |
| CSS token tweak | Designer → Dev → Code Reviewer | BA, Architect, Tester, Security |
| Config-only change | Architect → Dev → DevOps | BA, Designer, Tester |
| Hotfix (prod bug) | Dev → Code Reviewer → Security → DevOps (expedited gate) | BA, Architect, Designer, Tester |
| Docs-only change | Docs | All others |
| Dependency version bump | Security → DevOps | All others |

### 10.3 Human Gate — Required Before

- DevOps deploys to **production** (`vercel --prod`)
- SRE escalates a **P1 incident** to engineering
- Any agent **destructively modifies or deletes** database data

### 10.4 Rejection / Re-route Rules

| Scenario | Action |
|---|---|
| Code Reviewer requests changes | Reroute to Dev with review notes as input |
| Tester finds P1 bug | Reroute to Dev; block DevOps until re-tested |
| Security finds critical vulnerability | Block DevOps; notify user; route fix to Dev |
| SRE raises P1 incident | Create new BA task (incident as requirement); notify user |

### 10.5 Stage Entry Conditions

| Stage | Entry Condition |
|---|---|
| BA | Raw user request received |
| Architect | BA user stories + acceptance criteria are `done` |
| Designer | Architect component map + API contracts are `done` |
| Dev | Designer spec `done` **and** Architect sign-off `done` |
| Code Reviewer | Dev PR/diff is `done` |
| Tester | Code review `done` (no open blockers) |
| Security | Tester results `done` |
| DevOps | Security `done` **+ human gate approved** |
| SRE | DevOps deploy `done` |
| Docs | SRE stable (no P1 incidents open) |

---

## 11. Agent Roster & Responsibilities

### Orchestrator — `.agents/orchestrator/`

**Job**: Coordination, not implementation. Never writes product code.

- **Decomposes** every request into atomic tasks (one task per agent, one per stage)
- **Routes** tasks in dependency order per `routing_rules.md`
- **Gates** on human approval before any production deploy
- **Updates** `.agents/shared/ledger.md` after each sprint
- **Fast-tracks** simple changes by short-circuiting the pipeline

**Mandatory reads every session**: `CLAUDE.md` → `spec.md` (if it exists) → `project_context.md` → `ledger.md` → `routing_rules.md`

---

### BA (Business Analyst) — `.agents/ba/`

**Job**: Turns raw stakeholder input into structured, unambiguous requirements.

**Outputs per task:**
1. User Story (template: `.agents/ba/templates/user_story.md`)
2. Acceptance Criteria in **Given / When / Then** format (template: `.agents/ba/templates/acceptance_criteria.md`)
3. Implementation Plan — ordered list of files/components/endpoints to change (intent only, no code)

**Rules:**
- Every criterion must be testable by the Tester
- Do not prescribe implementation details — that is Architect's job
- If request contradicts existing features, flag it and ask Orchestrator before proceeding
- List expected i18n key names but don't write translations — that is Dev's job

**Does NOT**: write code · design UI · define data model

---

### Architect — `.agents/architect/`

**Job**: Translates BA stories and criteria into a concrete technical design.

**Outputs per task:**
1. **Component Map** — which Next.js components/pages are created/modified/deleted
2. **Data Model** — Prisma schema changes (new fields, new models, relation changes)
3. **API Contracts** — new or modified Next.js API routes: method, path, request shape, response shape
4. **Dependency changes** — any new npm packages with size/maintenance justification

**Standards for this repo:**
- Prisma: all new timestamp fields use `new Date()` / `updatedAt` auto-managed by Prisma
- Tenant isolation: every new model must have `tenantId`
- API routes: all must verify `tenantId` from NextAuth session before any DB operation
- NextAuth JWT: `id`, `role`, `tenantId` are the custom fields

**Does NOT**: write implementation code · make UI styling decisions · deploy

---

### Designer — `.agents/designer/`

**Job**: Translates approved BA specs and Architect component maps into a pixel-level UI specification.

**Design System:**
- Tone: Modern · premium · clean
- Typography: Use font choices consistent with the tenant's theme config
- Animations: Hover effects on all interactive elements; transitions 200–300 ms ease
- Loading states: spinner or shimmer skeleton — never a blank white screen
- Icons: Use `lucide-react` — specify component name, size, and strokeWidth
- Never specify emoji as UI elements

**Outputs per task:**
1. Component Spec — layout, spacing, color tokens, responsive breakpoints
2. Interaction Spec — hover, focus, loading, error, empty states
3. New CSS/Tailwind tokens (if any)
4. Accessibility notes — ARIA roles, keyboard nav, contrast ratios (≥ 4.5:1 body text)

**Does NOT**: write React JSX or CSS · change Prisma schema · approve own designs

---

### Dev — `.agents/dev/`

**Job**: Implements features against Architect + Designer specs, producing production-quality code.

**Implementation checklist before `done`:**
- [ ] `npm run build` passes with zero errors
- [ ] No `console.log` in committed code
- [ ] Every new `useEffect` / `use client` hook has cleanup where applicable
- [ ] New components are named exports, under 500 lines
- [ ] Derived booleans computed inline, not stored in state
- [ ] Hover/focus states per Designer spec
- [ ] No emoji in JSX — use `lucide-react` icons
- [ ] Any test script or diagnostic utility is placed in `local-utils/` (never in root, `scratch/`, or `src/`)

**Code style (from `CLAUDE.md`):**
- Components: `PascalCase`
- Hooks: `use` prefix, `camelCase`
- Event handlers: `handle` prefix
- Constants: `SCREAMING_SNAKE_CASE`
- Booleans: `is` / `has` / `can` / `should` prefix

**Critical gotchas for this repo:**
| Gotcha | Rule |
|---|---|
| `tenantId` in queries | Always from NextAuth session, never from input |
| Product deletion | Always soft delete (`deletedAt`) |
| Middleware | Don't modify root-domain blocking logic |
| `/api/internal/*` | No NextAuth — uses its own auth mechanism |
| Windows `.env` | No quotes around values |
| Prisma client | Import from `src/lib/prisma.ts` singleton only |
| Test & debug scripts | If creating a util to test something or a script that won't be part of the business app, MUST place it in `local-utils/` (never in root, `scratch/`, or `src/`) |

**Does NOT**: approve own code · deploy · run security scans

---

### Code Reviewer — `.agents/code_reviewer/`

**Job**: Reviews *how* something was built — quality, standards conformance, spec alignment.

**Review checklist:**

**Correctness**
- [ ] No obvious logic errors or off-by-one mistakes
- [ ] Async functions handle errors (try/catch or `.catch()`)
- [ ] `tenantId` is filtered on every Prisma query
- [ ] No cross-tenant data leaks

**Code Quality**
- [ ] No `console.log`
- [ ] No anonymous default exports
- [ ] No `await` inside `forEach` — use `Promise.all()`
- [ ] No derived booleans stored in state
- [ ] Every subscription / timer has a cleanup

**Style / Design System**
- [ ] No ad-hoc magic color values — use CSS tokens / Tailwind config
- [ ] New components < 500 lines

**Build**
- [ ] `npm run build` passes with zero errors

**Output format:**
- `✅ Approved` — brief summary
- `🔄 Changes Requested` — list each issue as `[BLOCKER | SUGGESTION] <file>:<line> — <description>`

**Does NOT**: fix code · run tests · self-approve suggestions after Dev fixes

---

### Tester — `.agents/tester/`

**Job**: Verifies every acceptance criterion from BA; surfaces bugs before Security or DevOps.

**Test plan format:**
```
## Test Plan — <Task Title>
Story ID: US-YYYY-MM-DD-NNN

### Scope
- Components tested:
- Endpoints tested:
- Out of scope:

### Test Cases
#### TC-001 — <Short title> (maps to AC-001)
- Pre-condition:
- Steps:
- Expected result:
- Actual result: [ PASS | FAIL | BLOCKED ]
```

**Test strategy:**
- Cover every `AC-NNN` with at least one `TC-NNN`
- Test happy path **and** at least one failure/edge case per criterion
- Verify at 375 px (mobile), 768 px (tablet), 1280 px (desktop)
- Test tenant isolation: verify one tenant cannot see another's data
- Smoke-test adjacent features that share the same components

**Bug report format:**
```
## Bug — <Short title>
Severity: P0 | P1 | P2 | P3
Steps to reproduce:
Expected:
Actual:
AC violated: AC-NNN
```

**Does NOT**: fix bugs · approve code · deploy

---

### Security — `.agents/security/`

**Job**: Security checks before every production deploy.

**Security checklist:**

**Secrets & Credentials**
- [ ] No secrets/API keys hardcoded in source
- [ ] `.env` is in `.gitignore` and not committed
- [ ] No secrets exposed in client-side bundles (check Next.js build output for `NEXT_PUBLIC_` leaks)

**Auth & Tenant Isolation**
- [ ] All API routes verify NextAuth session and `tenantId` before any DB operation
- [ ] Expired or revoked tokens rejected
- [ ] No unauthenticated endpoints that modify data
- [ ] `tenantId` never comes from user input

**Dependencies**
- [ ] `npm audit` — flag any `high` or `critical` vulnerabilities
- [ ] No unmaintained packages (last publish > 2 years ago)

**Input Validation**
- [ ] User-supplied text not rendered as raw HTML (`dangerouslySetInnerHTML`)
- [ ] File uploads limited to `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`

**Output format:**
- `✅ Clean` — summary of what was scanned
- `🔴 Blocked` — `[CRITICAL | HIGH | MEDIUM | LOW] — <description> | File: <path> | Recommendation: <fix>`

A `CRITICAL` or `HIGH` finding **blocks** the DevOps deploy.

**Does NOT**: fix vulnerabilities · deploy · approve release unilaterally

---

### DevOps — `.agents/devops/`

**Job**: Builds, deploys, and promotes the application. Acts **only after** the human gate is approved.

**Environments:**

| Environment | Command | Gate |
|---|---|---|
| Local dev | `npm run dev` (port 3000) | None |
| Staging | `vercel` (preview URL) | Automated on PR merge |
| Production | `vercel --prod` | **Human gate required** |

**Pre-deploy checks:**
- [ ] `npm run build` passes with zero errors
- [ ] Security agent scan is `done` and `clean`
- [ ] Tester results are all `PASS`
- [ ] Code Reviewer has approved
- [ ] Human gate confirmed (for production)

**Rollback:**
```bash
vercel rollback    # Roll back to previous production deployment
```

**Does NOT**: change application code · approve own deployments · debug application bugs

---

### SRE (Site Reliability Engineering) — `.agents/sre/`

**Job**: Monitors production after deploy, triages incidents, feeds actionable issues back to the pipeline.

**Monitoring signals for this repo:**

| Signal | Source | Threshold |
|---|---|---|
| API error rate | Vercel dashboard / logs | > 1% errors over 5 min |
| Response latency | Vercel analytics | p95 > 3s |
| DB query failures | Supabase dashboard | Any unexpected permission denied |
| AI evaluation failures | App logs | > 5% failure rate over 1 hour |
| Webhook failures | Conekta / WhatsApp webhooks | Any unprocessed event queue buildup |

**Incident severity:**

| Level | Definition | Response |
|---|---|---|
| P0 | Platform down — no users can access | Immediate: notify user + Orchestrator; consider rollback |
| P1 | Critical feature broken (orders/payments cannot complete) | < 1h; raise to Orchestrator + Dev |
| P2 | Degraded experience (AI suggestions failing, payment method unavailable) | < 4h; raise requirement to BA |
| P3 | Minor / cosmetic issue | Log in ledger; route to BA next sprint |

**Does NOT**: push code fixes · roll back without Orchestrator sign-off (except P0 with no Orchestrator available) · reassign engineering priority directly

---

### Docs — `.agents/docs/`

**Job**: Keeps all technical documentation current after every feature ships.

**Documents maintained:**

| Document | Location | When to Update |
|---|---|---|
| Tech reference | `CLAUDE.md` | Every new gotcha, pattern, file, or schema change |
| Decision ledger | `.agents/shared/ledger.md` | Every significant decision or lesson learned |
| Project context | `.agents/shared/project_context.md` | Every sprint goal change or major status update |
| API runbook | `.agents/docs/runbooks/api.md` | Every new or changed API route |
| Deploy runbook | `.agents/docs/runbooks/deploy.md` | Every environment or pipeline change |
| Changelog | `.agents/docs/CHANGELOG.md` | Every release |

**`CLAUDE.md` update rules:**
- Add new gotchas to the known issues section
- Update the Prisma schema description when models change
- Update the directory structure when new routes/pages are added
- Update the AI tools list when new Claude tools are added
- Bump the "Avoid These Mistakes" table when a new recurring mistake is discovered

**Does NOT**: write application code · decide what gets shipped · approve features

---

## 12. Non-Negotiable Constraints (All Agents Enforce)

| Constraint | Rule |
|---|---|
| `tenantId` on every query | Filter all Prisma queries by `tenantId` from the session — always |
| No `tenantId` from user input | Extract only from NextAuth JWT token |
| No `console.log` | Not in any committed code |
| Build must pass | `npm run build` zero errors before Code Reviewer approves |
| Soft delete products | Use `deletedAt` — never hard-delete active products |
| No secrets in source | Use environment variables only |
| No raw HTML rendering | No `dangerouslySetInnerHTML` on user content |
| Human gate for production | `vercel --prod` requires explicit human approval — no exceptions |
| **No emojis in UI** | Never use emoji characters in JSX/TSX — always use `lucide-react` icons. Icon-only buttons must have `aria-label`. |
| **Respect tenant theme** | Storefront and CRM components must use `bg-primary` / `text-primary` / CSS vars from `ThemeConfig` — never hardcode colors (`#hex`, `green-600`, etc.) for tenant components. Marketing page components are exempt. |

---

## 13. Task Graph Schema (Orchestrator Output Format)

```jsonc
[
  {
    "taskId": "<uuid-v4>",
    "title": "Short human-readable label",
    "stage": "requirements | architecture | design | implementation | review | testing | security | devops | monitoring | docs",
    "assignedAgent": "ba | architect | designer | dev | code_reviewer | tester | security | devops | sre | docs",
    "status": "pending",
    "blockedBy": ["<taskId-of-dependency>"],
    "humanGateRequired": false
  }
]
```

Set `humanGateRequired: true` only for tasks that trigger a production deploy.

---

## 14. Avoid These Mistakes

| Mistake | Correct Approach |
|---|---|
| Querying DB without `tenantId` filter | Always `where: { tenantId: session.user.tenantId, ... }` |
| Reading `tenantId` from req body or query params | Only from `getServerSession()` / `getToken()` JWT |
| Blocking tenant routes on root domain with redirects | Use `NextResponse.rewrite(new URL("/_not-found", req.url))` |
| Hard-deleting products | Set `deletedAt: new Date()` — soft delete only |
| Adding duplicate behavioral rules to AI prompts | System prompt = HOW. User prompt = WHAT (data only). Never repeat rules in user message. |
| Writing `tenantId` to the `x-session-user` header in app code | Middleware rewrites this header — never trust the client-supplied value |
| Calling Claude tools without `tenantId`-scoped Prisma queries | All tools in `execute-tool.ts` must filter by `tenantId` |
| Deploying to production without human gate | Always required — no exceptions |
| Modifying the root domain route blocking logic | It uses `rewrite`, not `redirect` — Vercel Edge requires this |
| Stripping behavioral rules from AI system prompts thinking they are "redundant" | Structural rules are executable constraints — only strip true duplicates |
| **Using emoji characters as UI elements** | Use `lucide-react` icons — never `⚠️`, `✅`, `📋`, etc. in JSX. Specify `size` and `strokeWidth`. Icon-only buttons need `aria-label`. |
| **Hardcoding colors in tenant components** | Use `bg-primary`, `text-primary`, `var(--color-primary)` etc. — colors come from `ThemeConfig` in the DB. Never use `#hex` or Tailwind named colors like `green-600` directly in `(public)/` or `admin/` components. |

---

## 15. File Cross-Reference

| Topic | File |
|---|---|
| Full tech stack, patterns & gotchas | `CLAUDE.md` |
| Orchestrator instructions | `.agents/orchestrator/system_prompt.md` |
| Routing rules & fast-track | `.agents/orchestrator/routing_rules.md` |
| Current sprint status | `.agents/shared/project_context.md` |
| Decision & lessons ledger | `.agents/shared/ledger.md` |
| BA user story template | `.agents/ba/templates/user_story.md` |
| BA acceptance criteria template | `.agents/ba/templates/acceptance_criteria.md` |
| Architect tech stack reference | `.agents/architect/standards/tech_stack.md` |
| Architect API contract form | `.agents/architect/standards/api_contract_form.md` |
| API runbook | `.agents/docs/runbooks/api.md` |
| Deploy runbook | `.agents/docs/runbooks/deploy.md` |
| Changelog | `.agents/docs/CHANGELOG.md` |
| Prisma schema | `prisma/schema.prisma` |
| Multi-tenant middleware | `middleware.ts` |
| Claude AI tools | `src/lib/ai/tools.ts` |
| Prisma client singleton | `src/lib/prisma.ts` |
| Shopping cart store | `src/store/` |
| NextAuth JWT types | `src/types/` |
