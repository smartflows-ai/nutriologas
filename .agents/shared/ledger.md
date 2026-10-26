# Decision & Lessons Ledger

> Append-only. One entry per meaningful decision or lesson learned.  
> Format: `## YYYY-MM-DD — <Agent> — <Title>`

---

## 2026-07-21 — System — Initial scaffold

Multi-agent SDLC team scaffolded under `.agents/`. Agents: Orchestrator, BA, Architect, Designer, Dev, Code Reviewer, Tester, Security, DevOps, SRE, Docs.

Human gate required before DevOps/SRE stages (pre-prod deploy) until team has a track record.

---

## 2026-07-21 — Dev — Date-based session TTL

`ScheduleInterviewModal` now stores `expiresAt` as 23:59:59.999 local on the selected interview date, not a fixed 3-hour window. Firestore schema updated with `interviewDate` (YYYY-MM-DD) and `interviewTime` (HH:MM) fields.

---

## 2026-07-21 — Dev — Fullscreen ending overlay

`Room.jsx` shows a fullscreen blur-overlay while `ending === true`. Stages: closing → generating → saving → auditing. Pattern matches `PositionsManager` "Generating Question Bank" modal.

---

## 2026-07-21 — Dev — Presto AI branding

AI co-pilot renamed "Presto AI" across all UI, document titles, and locale strings. No references to third-party model names in the user-facing UI.

---

## 2026-07-27 — Orchestrator — AI Question Bank & Report Refactor Sprint

Full pipeline run: BA → Dev → Code Reviewer → DevOps. Fast-tracked (no schema/design changes).

Decisions made:
- `GENERATE_SYSTEM` now requires exactly 3 challenges (MCQ-easy, open-medium, code-hard). No more 4–6 variable count.
- Code challenge prompt must end with full-credit pseudocode note. Rubric must award pseudocode same as syntactically complete code.
- 12–15 questions required; at least 40% must be theoretical/conceptual to prevent all-behavioral banks.
- `TRANSCRIPT_CLEANUP_SYSTEM` added: fast pre-pass using `gpt-4o-mini` inside `handleEvaluateSession` to fix STT errors and remove echo lines before evaluation model runs. Non-fatal — falls back to raw transcript on error.
- `SessionReport.jsx`: `reviewerName` removed from both JSX banner and HTML/PDF export. Only role title (e.g., "Technical Interviewer") + date shown. Email-derived username (e.g., YANKEES00000) no longer appears anywhere in reports.
- Worker deployed: Version ID `76ca9f9a-1541-48a4-9c3b-7bb592d52eb9` at https://sdet-ai-worker.yankees00000.workers.dev

---

## 2026-07-28 — Orchestrator — LLM Model Switch: Claude → Qwen3

**Pipeline**: Architect analysis → Dev (config) → DevOps. Config-only change — no application code modified.

**Decisions made:**
- All 5 flagship slots (`PARSE`, `GENERATE`, `EVALUATE`, `BIAS`, `CV`) switched from `anthropic/claude-sonnet-4.5` → `qwen/qwen3-235b-a22b` (~85% cost reduction, $0.455/$1.82 per 1M tokens).
- Both fast slots (`LIVE`, `CUSTOM`) switched from `anthropic/claude-3.5-haiku` → `qwen/qwen3-30b-a3b` (~95% cost reduction, $0.05–$0.12/$0.20–$0.50 per 1M tokens).
- Qwen3-235B chosen over Qwen2.5-72B: newer architecture, superior structured JSON compliance, better instruction following at depth — critical for our dense prompt schemas.
- Qwen3-30B (MoE, 3B active) sufficient for simple tasks (STT cleanup, custom question variation).
- Model IDs are unpinned (no `-2507` suffix) to automatically benefit from future quality updates.
- Architect rationale: our worker uses single-shot JSON-in/JSON-out calls — no persistent agentic context needed — making Sonnet's agentic superiority irrelevant here.
- Worker deployed: Version ID `d4d04026-2b37-48d3-bd98-a7a360216766` at https://sdet-ai-worker.yankees00000.workers.dev

---

## 2026-07-28 — Orchestrator — Free Model Hybrid Sprint

**Pipeline**: Architect analysis (live API scan) → Dev (config) → DevOps. Config-only, no code change.

**Free model inventory scanned**: 17 models via `/api/v1/models`. Only 3 viable for Presto AI (JSON + tools + sufficient context).

**Decisions made:**
- `LIVE` switched from `qwen/qwen3-30b-a3b` → `google/gemma-4-26b-a4b-it:free` (STT cleanup — simple task, JSON supported, 262K context, free)
- `CUSTOM` switched from `qwen/qwen3-30b-a3b` → `google/gemma-4-31b-it:free` (AI co-pilot Q&A — simple task, JSON supported, free)
- All 5 critical slots (PARSE, GENERATE, EVALUATE, BIAS, CV) remain on `qwen/qwen3-235b-a22b` — quality/reliability non-negotiable for user-facing outputs
- `nvidia/nemotron-3-super-120b-a12b:free` noted as best overall free model (120B MoE, JSON+tools, 262K context) — candidate for future PARSE/BIAS/CV if quality validates
- Architect rationale: savings vs Qwen3 are ~$0.002/session; not worth risking EVALUATE or GENERATE quality on free models with no SLA
- Worker deployed: Version ID `ebdc98cb-94ea-4721-a2da-29b1651fbd63` at https://sdet-ai-worker.yankees00000.workers.dev

---

## 2026-07-28 — Orchestrator — Question Bank Approval & Modification Workflow

**Pipeline**: BA Requirements → Architect Design → Dev Implementation → Code Reviewer → Docs.

**Decisions made:**
- New position fields: `questionsApproved: boolean` (defaults `false`), `questionsApprovedAt: Timestamp`, `questionsApprovedBy: string`.
- Interview Scheduling Gate: "Schedule Interview" button in `PositionDetail` is disabled with an explanatory tooltip until `questionsApproved === true`.
- Editing Workflow: Staff can edit question prompts, titles, rubrics, weights, categories, and challenge titles/prompts/rubrics prior to approval via modal editors.
- Immutability Lock: Clicking "Approve Question Bank" locks the question bank permanently (`🔒 Approved & Locked` badge). All edit controls are removed post-approval.
- i18n strings added to both `en.json` and `es.json`.
- Build verified with `npm run build` (0 errors).

---

## 2026-08-21 — Orchestrator — AI Prompt Engineering Sprint

**Pipeline**: Fast-track — Dev → Code Reviewer → Docs (no UI/schema change).

**Problems fixed:**
1. `GENERATE_SYSTEM` triple "Output raw JSON ONLY" → collapsed to one directive at top.
2. `[ignoring loop detection]` duplicated in both `EVALUATE_SYSTEM` and the user prompt → removed from system message, kept only in user prompt where it has effect.
3. `== MANDATE FOR ALL EVALUATIONS ==` block in `handleEvaluateSession` user prompt restated rules already in `EVALUATE_SYSTEM` → removed from user prompt (~200 tokens saved per evaluation call).
4. `cvText` raw fallback cap: 3,000 → 1,000 chars; never sent when `cvAnalysis` struct already exists.
5. `TRANSCRIPT_CLEANUP_SYSTEM` slimmed from 5 rules → 2 core rules; schema enforces the rest (~120 tokens saved per cleanup pre-pass).
6. `GENERATE_SYSTEM` phase count floor aligned: Phase 1 (5-7) + Phase 2 (5-7) + Phase 3 (4-6) = minimum 15 questions. Inline JS `// comments` inside JSON schema string removed (invisible to model, wasted tokens).
7. `orchestrator/system_prompt.md` replaced: was incorrectly storing the QB-generator prompt verbatim. Now contains the Orchestrator agent's actual SDLC coordination instructions (decompose, route, gate, ledger update). QB-generator prompt lives exclusively in `worker/src/index.js` as the single source of truth.

**Token savings**: ~1,000–1,500 tokens per full interview evaluation session. Primary benefit: smaller prompts reduce prompt-processing time, lowering timeout risk on `/evaluateSession`.

---

## 2026-08-24 — Orchestrator — GENERATE_SYSTEM Hotfix (Sequence Ordering Regression)

**Pipeline**: Fast-track hotfix — Dev → Code Reviewer (build) → Docs.

**Root cause**: The 2026-08-21 prompt engineering sprint over-trimmed `GENERATE_SYSTEM`. While collapsing redundant output directives and removing invisible JS comments was correct, the sprint also stripped these substantive quality sections that directly control model output behavior:
- `== SEQUENCE ORDERING ==` — the rule that enforces easy→hard ordering and explicitly forbids grouping by category. Without it, the model produces questions grouped as "all Domain Fundamentals, then all Tools, then all Behavioral" — exactly the "numbers in disorder" symptom reported.
- `== SENIORITY CALIBRATION ==`, `== TECH STACK COVERAGE ==`, `== DOMAIN SCENARIOS ==`, `== THEORETICAL vs EXPERIENTIAL QUESTION BALANCE ==`, `== QUESTION QUALITY RULES ==`, `== WEIGHT GUIDANCE ==`, `== MCQ DISTRACTOR QUALITY ==`, `== CODE CHALLENGE RULES ==`, `== TIME-BOX CONSTRAINT ==`, and the full 13-point `== FINAL CHECK ==`.

**Fix**: Restored all stripped sections into `GENERATE_SYSTEM` while keeping the valid optimizations from the previous sprint (single output directive, no invisible JS comments, aligned phase counts floor at 15). The full 13-point FINAL CHECK is now at item 14 with the phase count rule appended.

**Lesson learned**: In system prompts, structural/behavioral rules are not "redundant prose" — they are executable constraints. Only strip true duplicates (same rule stated twice in the same message). Never strip a rule section just because the information feels implied by the schema.

---

## 2026-08-24 — Orchestrator — Hotfix: User Prompt Rule Duplication (Model Echo)

**Pipeline**: Fast-track hotfix — Dev → Code Reviewer (build) → Docs.

**Symptom**: `POST /generateQuestionBank` returned 502 — "Model did not return valid JSON". Model output was: "We need to produce raw JSON only, no markdown. Provide questions array (15-20 items)..." — the model was echoing the instructions instead of executing them.

**Root cause**: The `handleGenerateQuestionBank` user prompt contained a full `== GENERATION INSTRUCTIONS ==` block + 7-point `Before returning, verify:` checklist (L469–494) that duplicated every rule already in `GENERATE_SYSTEM`. Total instruction payload was effectively doubled. When a model receives the same rules twice — once as system and once as user — it enters "acknowledgement mode": it summarizes and restates the instructions rather than executing them. This is a well-known LLM failure mode for oversized/contradictory prompts.

**Fix**: Stripped the user prompt down to pure data: role context header + numbered tech skill list + nice-to-have list + soft skills list + one-line execution trigger ("Generate the question bank now."). All behavioral rules (phase structure, ordering, constraints, verify checklist) stay exclusively in `GENERATE_SYSTEM`.

**Design principle established**: System prompt = HOW to generate. User prompt = WHAT to generate (data only). Never repeat behavioral rules in the user message when they are already in the system message.

## 2026-09-04 — Orchestrator — LangGraph Migration: Interview AI Pipeline

**Pipeline**: Fast-track — Dev → Code Reviewer (build) → Docs. No schema/UI change.

**What changed**: Migrated the Cloudflare Worker AI pipeline from flat sequential handler functions to **LangGraph StateGraphs** (`@langchain/langgraph/web`).

**New files**:
- `worker/src/state.js` — shared state type definitions and constants (`MAX_CHUNKS`, `KIND_ORDER`, etc.)
- `worker/src/graphs/evalGraph.js` — `InterviewEvalGraph` with 5 nodes: `transcriptCleanup → buildPrompt → evaluate → biasAudit → formatOutput`
- `worker/src/graphs/questionBankGraph.js` — `QuestionBankGraph` with retry loop: `buildPrompt → generate → validate (→ retry ≤2x | → markdownFallback) → formatOutput`

**Modified**: `worker/src/index.js` — `handleEvaluateSession` and `handleGenerateQuestionBank` now delegate to compiled LangGraph graphs. All other handlers unchanged. ~425 lines of inline sequential logic removed from index.js.

**Public API surface**: Unchanged. Same endpoints, same request/response shapes, same Firebase auth.

**Build verified**: `wrangler deploy --dry-run` → exit 0, bundle 2861 KiB / 534 KiB gzip (well within 25 MiB limit).

**Key benefits**:
- Each AI step is now a named, testable node (not buried inline)
- `QuestionBankGraph` retries generation up to 2x before markdown fallback — more robust than the single-shot old handler
- Bias audit is now part of the eval graph pipeline — result returned inline as `_biasAudit` in the evalSession response, eliminating the need for a separate React `/biasAudit` call
- Typed intermediate state enables easier debugging and future extension (e.g. adding a `validateReportNode` is now trivial)

---

## 2026-09-14 — Orchestrator — NewAigent AI Token Credits & Spending Cap Engine

**Pipeline**: BA Requirements → Architect Design → Dev Implementation → Code Reviewer → Docs.

**Context & Decisions:**
- **Problem**: Multi-tenant tenants running on Starter tier ($15 USD) or custom tiers required hard guardrails to prevent runaway AI consumption via OpenRouter across chat assistant, social campaigns, and WhatsApp workflows.
- **Data Model**: Added `AiTokenLedger` model mapped to monthly billing cycles (`periodStart` to `periodEnd` UTC boundaries) with prompt and completion token accounting and USD expenditure tracking. Added `pausedByCredits: Boolean` on `SocialCampaign`.
- **Cost Formula**: Built in `src/lib/credits.ts` utilizing `OPENROUTER_INPUT_PRICE_PER_M` ($3.00/1M) and `OPENROUTER_OUTPUT_PRICE_PER_M` ($15.00/1M).
- **Enforcement Flow**:
  - `POST /api/chat`: Pre-flight check via `enforceCredits()`. If spent >= limit, returns HTTP `402 Payment Required`. Frontend blocks input and triggers sonner toast alert.
  - `GET /api/campaigns/social/due`: Excludes campaigns where `pausedByCredits = true`. Performs real-time tenant credit check, immediately calling `pauseCampaignsForTenant()` if exhausted.
  - External automation reporting: `POST /api/internal/tokens/report` accepts token usage from external n8n workflows with `x-internal-key`.
- **Recharge & Resumption**:
  - `POST /api/credits` generates a Stripe Checkout session ($15 USD top-up).
  - Stripe webhook (`checkout.session.completed`) calls `rechargeCredits()`, increments `creditLimitUsd`, and automatically reactivates paused campaigns via `resumeCampaignsForTenant()`.

---

## 2026-09-14 — Dev — Layout & Dynamic Theming Engine Fixes

**Pipeline**: Dev → Code Reviewer → Docs.

**Decisions & Lessons Learned:**
1. **CSS Containing Block Clipping with Backdrop Blur**:
   - *Symptom*: When `CreditsDrawer` was placed inside `AdminSidebar`, its width was cut off horizontally.
   - *Root Cause*: Parent container `aside` had `backdrop-blur-md` and `overflow-hidden`. In modern CSS, `filter` or `backdrop-filter` creates a new containing block for `position: fixed` child elements, constraining fixed elements to the parent's boundary.
   - *Resolution*: Portaled `CreditsDrawer` directly to `document.body` using React `createPortal`.
2. **Left-Side Positioning**:
   - Moved drawer from right-side slide-over to left side (`left-0`, `border-r`, `slide-in-from-left`) to preserve visual alignment and natural navigation alongside the left sidebar.
3. **Dynamic Typography & Tenant Theme Inheritance**:
   - *Symptom*: Modals/drawers escaping to `document.body` fell back to system default fonts instead of the tenant's chosen font in `/admin/apariencia` (`ThemeConfig.fontFamily`).
   - *Resolution*: Bound `--font-family-base` on `<html>` and `<body>` in `src/app/layout.tsx` and dynamically injected `:root` variables in `src/app/admin/layout.tsx`. Portaled elements explicitly apply `style={{ fontFamily: "var(--font-family-base), system-ui, sans-serif" }}`.

---

## 2026-09-14 — Architect — Prioritized 5-Model Cascade & Monetization Architecture

**Pipeline**: Architect Design → Dev Implementation → Code Reviewer → Docs.

**Strategic Rationale & Implementation:**
- **Business Alignment**: Free-only models eliminate tenant credit exhaustion, undermining the $15 Stripe recharge revenue stream. Paid flagship models must lead the stack to consume the $15 allowance legitimately while providing top-tier Spanish CRM tool-calling autonomy.
- **5-Model Priority Stack**:
  1. `anthropic/claude-3.5-sonnet` (Primary paid driver, $3.00/$15.00)
  2. `openai/gpt-4o` (Secondary paid failover, $2.50/$10.00)
  3. `google/gemini-2.0-flash-exp:free` (High-speed 1M context zero-cost fallback)
  4. `meta-llama/llama-3.3-70b-instruct:free` (Open-weights function-calling fallback)
  5. `deepseek/deepseek-chat:free` (671B MoE zero-cost resilience safety net)
- **Dynamic Accounting**: `computeTokenCost` inspects the responding model. Free models log $0.00 USD spend to protect user balances during outages, while paid models deduct at their designated rates.

---

## 2026-09-14 — Architect & Dev — Platform AI Metering & SaaS Arbitrage Engine

**Pipeline**: Architect Design → Dev Implementation → Code Reviewer → Docs.

**Strategic Shift & Implementation:**
- **Business Model**: Shifted from pure pass-through provider pricing to **Platform AI Metering (SaaS Arbitrage)**. Tenants purchase platform service units, not OpenRouter tokens.
- **Retail vs. Wholesale Accounting**:
  - **Billed Expenditure (`totalCostUsd`)**: The tenant is ALWAYS debited at standard retail rates ($3.00 / 1M prompt, $15.00 / 1M completion), regardless of whether the request resolved to a free or paid model. This guarantees steady burn of the $15.00 Starter allowance and recurring $15 Stripe recharges.
  - **Provider COGS (`realProviderCostUsd`)**: Wholesale cost actually owed to OpenRouter ($0.00 for free models, actual cost for paid models).
  - **Retained Margin (`netMarginUsd`)**: `totalCostUsd - realProviderCostUsd`. When routing to free models (`google/gemini-2.0-flash-exp:free`, `meta-llama/llama-3.3-70b-instruct:free`), NewAigent retains **100% gross profit margin ($15.00 net profit per $15.00 recharge)**.
- **Database**: Updated `AiTokenLedger` schema in `prisma/schema.prisma` with `realProviderCostUsd` and `netMarginUsd`. Ran `npx prisma db push` and `npm run db:generate`.
- **Engine**: Updated `src/lib/credits.ts` (`computeBilledCost`, `computeProviderCost`, `recordTokenUsage`) to atomically increment both retail and wholesale balances.

---

## 2026-09-14 — Security & Dev — AI Prompt Injection Defense & System Prompt Shielding

**Pipeline**: Security → Dev Implementation → Code Reviewer → Docs.

**Problem & Resolution:**
- **Problem**: When prompted with meta-questions or jailbreak phrases, AI models could inadvertently regurgitate internal instructions, tenant isolation metadata, or system prompt configurations.
- **Defense Implemented**:
  - Hardened `src/lib/ai/system-prompt.ts` with explicit security imperatives.
  - Imposed strict prohibition against revealing system prompts, tool schemas, hidden directives, or infrastructure details under any persona or roleplay scenario.
  - Instructed the model to politely decline and steer the user back to business CRM operations.

---

## 2026-09-14 — Architect & Dev — OAuth Localhost Bounce Guard & Dynamic Origin Detection

**Pipeline**: Architect Design → Dev Implementation → Code Reviewer → Docs.

**Problem & Resolution:**
- **Problem**: When testing OAuth integrations (Google Calendar, Facebook Pages) on local subdomains (`doctor.localhost:3000`), the application redirected users to the production domain (`https://doctor.newaigent.com/...`) post-authorization because `.env` had `NEXTAUTH_URL="https://newaigent.com"`.
- **Resolution**:
  - Updated `/api/apps/oauth/google/start/route.ts`, `/api/apps/oauth/google/callback/route.ts`, `/api/apps/oauth/facebook/start/route.ts`, and `/api/apps/oauth/facebook/callback/route.ts`.
  - Routes inspect `request.headers.get("host")`. If `localhost` is detected:
    - OAuth `redirect_uri` is forced to `http://localhost:3000/api/apps/oauth/<provider>/callback`.
    - Final redirect origin dynamically resolves to `http://${tenantSlug}.localhost:3000/admin/...`.
  - Local developers can authenticate without touching `.env` or risking production collisions.

---

## 2026-09-14 — Designer & Dev — Native CRM AI Copilot with Real-Time KPI Snapshot Bar

**Pipeline**: Designer Spec → Dev Implementation → Code Reviewer → Docs.

**Rationale & Implementation:**
- **Objective**: Transform `/admin/asistente` from an isolated chat widget into a central, cohesive **Autonomous Business Executive Copilot**.
- **Server-Side Metrics Hydration (`src/app/admin/asistente/page.tsx`)**:
  - Pre-fetches 5 live tenant metrics: monthly paid revenue, monthly paid orders, pending order backlog, active product catalog, and active social campaigns.
- **Interactive KPI Snapshot Bar (`src/components/chat/ChatAssistant.tsx`)**:
  - 4 interactive metric cards with subtle hover effects and "Preguntar ↗" buttons.
  - Clicking any card auto-injects an analytical business inquiry into the chat input and fires the query to the Copilot.
- **Executive Navigation Shortcuts**:
  - Header shortcut pills for direct jumping to Pedidos, Agenda, Catálogo, and Campañas.
- **Visual Polish & Branding**:
  - Replaced bright red user bubbles with sleek dark slate (`bg-gray-900 text-white`).
  - Replaced generic assistant bubbles with verified business copilot badges (`Copiloto · {tenantName} · Datos Reales`).
  - Removed "Powered by Claude" in favor of native platform guarantee.
  - Fully localized in Spanish and English (`src/i18n/`).

---

## 2026-09-14 — Dev — Standalone AI Triage & Onboarding Retirement

**Pipeline**: Dev Implementation → Code Reviewer → Docs.

**Decision & Implementation:**
- Deprecated standalone AI Triage & Onboarding card in `/admin/apps` and removed the "Pacientes/Triage" sidebar navigation link (`AdminSidebar.tsx`).
- Customer management is natively unified into core CRM customer records and conversational copilot queries.

---

## 2026-09-14 — Dev & Docs — Mandatory local-utils/ Directory Rule Enactment

**Pipeline**: Docs & Rules Synchronization.

**Rule Enacted**:
- All ad-hoc testing utilities, DB inspection scripts, webhook simulators, and non-production scripts must reside strictly inside `local-utils/`.
- No scratch scripts permitted in root, `scratch/`, or `src/`.
- Codified across `CLAUDE.md`, `spec.md`, `.agents/AGENTS.md`, and `.agents/dev/system_prompt.md`.

---

## 2026-10-17 — Architect & Dev — Unified Scheduling Hub & External Calendar Normalization

**Pipeline**: BA Requirements → Architect Design → Dev Implementation → Code Reviewer → Docs.

**Problems & Resolutions:**
1. **Multi-Calendar Fragmentation**: The CRM previously segregated appointments into separate tabs ("Gestión de Citas" vs "Vista Calendario") which displayed conflicting KPI metrics (e.g. 1 native appointment vs 2 total events) and duplicated calendar UI components.
2. **Consolidated Single View (`/admin/citas`)**:
   - Replaced multi-calendar tabs with **one unified agenda** combining native CRM appointments and external Google/Microsoft calendar events.
   - Built an interactive **Mini-Calendar** sidebar that reflects dot indicators for any appointment regardless of origin, allowing seamless date filtering without page reloads.
   - External events are normalized via `src/lib/external-calendar.ts` and delivered via `GET /api/appointments` alongside native bookings.
   - Google Calendar appointments feature verified integration badges and direct "Abrir en Calendar ↗" deep-links.
   - `/admin/calendario` redirects directly to `/admin/citas`.
3. **Automated Patient Notification**:
   - Marking an appointment `CONFIRMED` via `PATCH /api/appointments/[id]` dispatches a personalized WhatsApp notification to the patient detailing doctor name, service, date, time, and duration.

---

## 2026-10-17 — Dev & Security — Evolution API v2 Configuration Invariants & QR Polling Handshake Fix

**Pipeline**: Dev Implementation → Security & Integration Verification → Docs.

**Problems & Resolutions:**
1. **QR Modal Freezing (`WhatsAppModal`)**:
   - When scanning the QR code from mobile devices, the modal remained stuck on "Waiting for you to scan the QR".
   - **Root Cause**: The status polling route called `/instance/connect` on every 3-second cycle, which reset the Baileys socket while the phone was attempting the handshake. Furthermore, `/instance/connectionState` returned delayed states compared to real-time instance tables.
   - **Fix**: Replaced disruptive connect calls with read-only inspection via `fetchInstances?instanceName=${instanceName}`, detecting `connectionStatus === "open"` and extracting `ownerJid` instantly.
   - Polling interval set to 2000ms with automatic 1.2s exit animation and mount check for pre-authenticated sessions.
2. **Evolution API Instance Configuration Flags**:
   - Enforced required flags in `POST /api/apps/connect/whatsapp` during instance creation and explicit `/settings/set` + `/webhook/set` sync:
     - `events: ["MESSAGES_UPSERT"]`
     - `webhookBase64: true`
     - `rejectCall: true` (Reject Calls)
     - `groupsIgnore: true` (Ignore Groups)
     - `readMessages: true` (Read Messages)
     - `alwaysOnline: true` (Always Online)
     - `readStatus: false` (Read Status disabled)
     - `syncFullHistory: false`
   - Verified live against Evolution API instance database.


---

## 2026-10-17 — Dev — Vertical-Aware UX: Hide Ecommerce Elements for Service Tenants

**Pipeline**: Dev Implementation → Docs.

**Problem & Rationale:**
- Service-based tenants (`HEALTH`, `TOURISM`, `PETS_HOTEL`) operate entirely through `Appointment` and never create physical `Order` records.
- Previously, the admin sidebar always displayed "Pedidos" and the public storefront Navbar always showed the shopping cart icon and "Mis Pedidos" link, causing confusion and dead-end routes for clinic/service users.

**Changes Implemented:**

### Admin Sidebar (`src/components/admin/AdminSidebar.tsx`)
- Added `isOrders?: boolean` flag to `NavItem` interface.
- Computed `isEcommerce = vertical === "ECOMMERCE"` alongside existing `isHealth`.
- Tagged the Pedidos nav item with `isOrders: true`.
- Filter rule: `if (item.isOrders && !isEcommerce) return false` — hides "Pedidos" for all non-ecommerce verticals.

### Public Layout (`src/app/(public)/layout.tsx`)
- `getTenantPublicData()` now fetches and returns `vertical` from the `Tenant` record.
- Passes `isEcommerce={vertical === "ECOMMERCE"}` as a prop to `<Navbar>`.

### Public Storefront Navbar (`src/components/shop/Navbar.tsx`)
- Added `isEcommerce?: boolean` prop (defaults to `true` for backwards safety).
- Four elements now conditionally rendered only when `isEcommerce` is true:
  1. Desktop shopping cart icon button (top-right)
  2. Mobile drawer cart link
  3. Desktop "Mis Pedidos" user pill (authenticated state)
  4. Mobile drawer "Mis Pedidos" link (authenticated state)
- "Mis Citas" link remains visible for all verticals.

**Vertical Matrix (Post-Change):**

| Vertical | Admin: Pedidos | Storefront: Cart | Storefront: Mis Pedidos | Storefront: Mis Citas |
|---|---|---|---|---|
| `ECOMMERCE` | ✅ | ✅ | ✅ | ✅ |
| `HEALTH` | ❌ | ❌ | ❌ | ✅ |
| `TOURISM` | ❌ | ❌ | ❌ | ✅ |
| `PETS_HOTEL` | ❌ | ❌ | ❌ | ✅ |





## 2026-10-20 — Architect & Dev — WhatsApp AI Bot and Separate Reminders Workflow

**Pipeline**: Architect Design → Dev Implementation → Docs.

**Decisions made:**
- **Reminders in their own workflow, no LLM.** Deterministic sending every 15 minutes. The bot's chat workflow stays focused on conversation.
- **Patient identity is the WhatsApp number.** Bookings and changes require the number that made the booking.
- **Prices can be quoted, never changed or discounted.** The prompt and the backend both enforce it; the price comes from the Product record.
- **Reminder offsets configured per tenant in the CRM** (`reminderOffsetsMinutes`, default 24 h and 2 h). One message per run, all reached offsets marked as sent.
- **Free OpenRouter models kept for now** for the bot. Quality checks on tool calling are the open risk.
- **Secrets stay hardcoded in the n8n workflows** because this n8n instance has no environment variables or credentials for those values. Rotate them when that changes.
- **Evolution API kept.** Migration to WhatsApp Cloud API (Meta) is planned, not started.

**Lessons learned:**
1. In n8n, `$('Node').item` fails inside tool and Code nodes with "No data found from `main` input". Use `$('Node').first().json`.
2. `$env` is not available in this n8n instance.
3. A connected output parser makes free models fail with "Received tool input did not match expected schema". Keep the agent without one.
4. Tool results and old memory influence the model. Clear the test session's memory after changing the prompt, or the model copies the old replies.
5. Apply `npm run db:push` before activating the reminders workflow.

**Open items:** live test of the bot end to end, reminder migration, CRM reminder settings, Meta migration.

## 2026-10-20 — Designer & Dev — Minimal UI skill and tenant restyle

**Decision:** Tenant screens (CRM, storefront, login/registro) move to a flat, neutral style like Claude or ChatGPT. The tenant's saved colors and font are kept. Dark NewAigent brand pages (landing, legal, billing, 404) are out of scope.

**What was built:**
- Skill `.claude/skills/minimal-ui/` with `references/style-spec.md`.
- `local-utils/minimal-ui/audit.js` (report) and `restyle.js` (codemod, dry run by default). Scope and rules in `config.js`.
- Shared classes in `src/app/globals.css` (`btn-*`, `input`, `card`, `badge`) rewritten to the spec.

**Lessons:**
- Tenant colors must be applied as tokens (`primary`, `secondary`, `accent`) with opacity modifiers. Decorative gradients and tinted panels were the main source of visual noise.
- Codemod rules must match whole class tokens. Removing a class leaves extra spaces, so the script collapses double spaces only on changed lines.
- Status colors (paid, error, pending) and third-party brand colors (Facebook, Instagram, Google, WhatsApp, PayPal) stay as they are.

**Open:** manual items from the audit (gradients, tinted icon circles and badges) need a per-screen decision.

## 2026-10-20 — Dev — Country code selector and mandatory WhatsApp number

**Decision:** Clients and the tenant store phone numbers as `+<dial><digits>`. The WhatsApp number of the business is required, because WhatsApp, reminders and the storefront button depend on it.

**What changed:**
- `src/lib/phone.ts`: country list, `buildFullPhone` (builds `+CC...`, a leading `+` overrides the selector) and `splitFullPhone` (splits a stored number for editing; numbers without `+` fall back to +52).
- `BookingFlow.tsx` and `/admin/negocio`: country selector next to the phone input.
- `PATCH /api/tenants/business`: `whatsappNumber` is required, format `^\+\d{8,15}$`.
- Business page: required field and the same check before submit.

**Lessons:**
- Keep one parser and one formatter for phone numbers. Two copies would drift.
- `formatWhatsAppNumber` in `src/lib/whatsapp.ts` still treats a 10-digit number as Mexican. Numbers stored with `+CC` pass through it unchanged, so only old numbers rely on that default.

**Open:** existing tenants without a number must add one on their next save. The reminder and bot flows were not tested with the new format.

## 2026-10-20 — Orchestrator — Multi-tenant rules added to CLAUDE.md

**Decision:** Every UI or data-formatting change is designed as a rule for all tenants. A screenshot is one case, not the spec.

**What changed:** `CLAUDE.md` has a new section "Reglas Multi-Tenant (Pensar en Todos los Negocios)" under the tenant style rules. It covers no tenant-specific data, free text shown as written (no parsing of bot or patient text), and the checks to run before closing a UI change (empty, long, other vertical, dark mode, extreme tenant colors).

**Lesson:** A note-formatting helper built from one appointment note broke on other bot output. The rule now asks to fix the format at its source.

## 2026-10-20 — Dev — Calendar mirror and clinic time

**Decision:** The appointment row is the source of truth. The connected calendar (Google or Outlook, one per tenant) only mirrors it. The row stores `externalProvider` and `externalEventId`, and every listing hides calendar events that a row already mirrors. Web and bot bookings share one service (`appointments-service.ts`).

**Decision:** Times chosen by the patient are clinic wall time (`-06:00`). They are built and read with `src/lib/clinic-time.ts`.

**Lesson:** Building a time with a `Z` suffix stored a 17:00 slot as 11:00 in Mexico, and availability then blocked the wrong hour. A second bug was similar: the admin card showed the account email, not the email the patient typed. Store what the patient typed in its own column.

**Open:** Existing web bookings made before the time fix are 6 hours early. Not corrected yet.

## 2026-10-20 — Dev — Per-contact bot switch and owner replies

**Decision:** The bot's own reply is stored under a `bot-` key before it is sent. Evolution's echo of that reply is recognized by content within 60 s for the same contact (JID or alt JID), and an echo neither stores a second row nor pauses the bot. Any other `fromMe` message is the owner writing to the contact, so it pauses the bot.

**Decision:** A chat with no row is answered. The contact-status check fails open only for that case; a failed call stops the workflow run, which is a known gap.

**Lesson:** Matching the echo by key alone fails: the bot's reply and its echo have different keys. Storing the reply first and matching by content keeps the pause logic correct without relying on Evolution's key format.

**Open:** Echo matching for `@lid` contacts depends on Evolution sending `remoteJidAlt`. Verify with a real event before relying on it.

## 2026-10-20 — Dev — Fail closed on the bot pause check

**Decision:** If the contact-status or pending check fails, the n8n run stops and the bot does not answer. Only an explicit `botEnabled: true` lets it reply.

**Lesson:** The pause check was returning 404 in production because the route had not been deployed. `onError: continueRegularOutput` hid that, and the bot kept answering paused contacts. A fail-open check hides exactly the failure it exists to catch. `local-utils/check-prod-routes.mjs` now lists the routes the workflows need.

## 2026-10-20 — Dev — One booking schedule and bookable items

**Decision:** Booking hours come from one weekly schedule on the tenant (`businessHours`), used by the web and the bot. Only items with `isBookable` (tenant booking on and `requiresBooking`) can be booked. Other items are information only.

**Lesson:** Hours were hard-coded in two places and disagreed: the web used Mon-Sat 09-18 and the bot used every day 08-20. A 1000-minute service showed slots on the web and none in the bot, which is correct, because no start time fits. The web list ignored the duration. The bot prompt was also stored whole in chat memory on every turn, so the 12-message window held mostly prompt copies and customer names dropped out.

**Open:** `npm run db:push` for `Tenant.businessHours` has not been run. Run `local-utils/backfill-requires-booking.mjs` before deploying. Test the bot with a 1000-minute service and with an information-only item after deploy.

## 2026-10-21 — Dev — Patient history by phone key

**Decision:** A patient is the phone digits of the tenant's visits, normalized to `52` + 10 digits. `Appointment.patientKey` stores it, so the patient list is one grouped query. Clinical notes are one row per visit (`AppointmentNote`) and keep the patient key.

**Lesson:** Two phone formats for one person (`+52...`, `521...`, and 10 digits with no country code) split the history, so the key rule has to cover all three. In PostgreSQL, `'D'` did not strip the `+` in our setup; `'[^0-9]'` works. Test the SQL in a rolled-back transaction before the real statement, and print the groups it produces.

**Open:** The `appointments.patientKey` column, its index and the backfill are not applied yet; the patient page and the notes saves need them. Restart the dev server after the statements run.

## 2026-10-21 — Dev — Credit handling, owner alerts, shared OpenRouter balance

**Decision:** All tenants share one OpenRouter account with no per-tenant key. Reordered `OPENROUTER_MODELS` to try free models first and paid models last, since a $10 top-up permanently raises the account-wide free-model cap (50 to 1000 requests/day) and Claude Sonnet 4.5's real cost already equals its retail billing rate (zero margin). Added a credit gate to the WhatsApp bot (`bot/context` returns `creditExhausted`; n8n's "Guard: Credits OK" skips the LLM call and sends a fixed degrade reply once a tenant's monthly credits are exhausted) and an error branch on "Bot Agent" (`onError: continueErrorOutput`) so a total model-cascade failure sends the customer a fixed apology instead of silence.

**Lesson:** The `isPaused` block in `recordTokenUsage` looked like a one-shot gate but isn't — it re-asserts `isPaused: true` on every call while exhausted, so a notification added there needs to compare the ledger's *prior* `isPaused` value first, not just the current exhausted status, or it fires on every message instead of once per billing period.

**Open:** Owner alerts go to `Tenant.whatsappNumber` (the business's own WhatsApp, no separate owner-phone field exists). Bot-failure alert cooldown is 60 minutes (`Tenant.botFailureAlertedAt`). No per-tenant OpenRouter key exists; revisit only if one noisy tenant starts starving others of the shared real-dollar balance.

**Follow-up:** The social campaign workflow (`n8n-social-campaign-workflow.json`) had the same silent-failure shape: its "Notify Error" node posted to `$env.WEBHOOK_URL`, which this n8n instance never exposes, so a failed post never reached anyone despite `neverError: true` hiding that fact. Fixed by pointing it at a new `POST /api/internal/campaigns/alert-failure`, reusing `notifyTenantOwner` and throttling with the campaign's existing `lastErrorAt` field instead of adding a new column.

## 2026-10-21 — Dev — Bot dates, past hours, product delete and categories

**Decision:** The bot never works out weekdays. `bot/context` sends a 14-day calendar with weekday, date and hours, and the prompt uses it. No appointment is created at a time that already passed, for any creator. Deleting a service removes the row only when no order, review or appointment points to it.

**Lesson:** The model guessed weekdays from a date string and quoted wrong days (Friday 24 for Friday 23; a closed Tuesday that was open). Give the model the calendar computed in code. Also, the web POST had no past-time check; server rules must cover every creator, not just the bot routes.

**Open:** A booking made by the bot on 2026-10-24 22:20 UTC is stored on the wrong day and hour compared with what the customer was told. Check the n8n execution for the `book_appointment` input before moving it. Re-import the workflow and deploy the latest commits for the prompt and context changes to reach production.

## 2026-10-21 — Dev — Bot email for invites, reschedule without name, neverError tools

**Decision:** The bot needs a valid customer email before a new booking, because the email becomes the calendar attendee and Google or Outlook sends the invite. No separate confirmation email exists; the invite is the confirmation. Rescheduling and cancelling never ask for name or email. The five bot tool nodes return errors as data (`neverError`).

**Lesson:** The prompt rule "antes de agendar" was read as applying to reschedule, so the bot asked for the name on every change. Scope prompt rules to the exact tool they concern. A failed tool call that the agent cannot read ends the run, and the customer gets no reply.

**Lesson:** Raw `pg` queries on `timestamp without time zone` columns read values in the machine's timezone, which made the appointment times look shifted. Read times through Prisma, or convert them explicitly, before drawing conclusions. The helper scripts `local-utils/check-appointment-times.ts`, `check-busy-periods.ts`, `check-day-slots.ts` and `check-calendar-text.ts` print times with the clinic clock.

**Open:** Re-import `local-utils/n8n-chat-workflow-v2.json` into n8n; the email rule, the reschedule rule and the tool changes live in the workflow. Deploy the latest commit so `bot/book` returns `email_required` and `bot/context` returns `calendarText`. Retest a new booking, a reschedule and a slot conflict.

## 2026-10-23 — Dev — Appointment reminders with confirmation and auto-release

**Decision:** One reminder per visit (day before or same day, owner's time). A visit is released when the customer has not replied SI by the deadline, which the owner sets in hours before the visit. Each reminder is charged $0.0085 (Meta's Mexico utility rate) so owners get used to per-message pricing before the move to Meta. Owner-facing and customer-facing text is translated through i18n; each business picks its message language (`messageLanguage`). A visit booked after its reminder time counts as confirmed and is never released.

**Lesson:** The reminder time and the release deadline can overlap for same-day reminders, so the planner must treat a visit with no time left to answer as plain-reminder only. Owners must not see braces or variable names: placeholders are plain labels in square brackets, read from the translation files, and the server accepts the label of every language.

**Lesson:** Writing Spanish text with `node -e` in the shell is unsafe: backticks inside the text run as commands and quotes break the file. Use the edit tool or a quoted heredoc for any text that contains code formatting.

**Open:** Re-import `local-utils/n8n-chat-workflow-v2.json` and `local-utils/n8n-reminders-workflow.json` in n8n, deploy, then test: a reminder reaches a real phone, a "sí" confirms, silence releases the visit (calendar event removed, slot free, cancellation sent), "Liberar ahora" works from the Confirmaciones tab, and an English business gets English messages. Verify the Meta rate on Meta's rate card before raising the price.

## 2026-10-23 — Dev — Minimal UI pass on tenant screens

**Decision:** Audit with `local-utils/minimal-ui/audit.js`: all auto rules at 0. The 15 remaining `shadow-lg` matches are modal and dropdown overlays, which the spec keeps. Fixed the calendar's hardcoded light-only colors (dark mode now uses `.dark` variants) and removed its uppercase column headers. The dashboard rating card icon circle is neutral now; the star stays yellow as a rating cue. Semantic status colors (paid, active, error, Facebook/Instagram brand) were left as they are.

**Open:** Chart grid lines (`stroke="#f0f0f0"` in SalesChart, AppointmentsChart, ProductsChart, CampaignMetrics) stay light in dark mode. Visual check at 375 px and with a non-default primary color is still pending.

## 2026-10-26 — Dev — Owner name and business location

**Decision:** Any vertical can have a physical place, so location is optional behind a "physical location" switch; the address is required only when it is on, and turning it off clears it. The address is chosen with Google Places search through our own server endpoints (the key never reaches the browser; per-IP limiter on the public routes). If search fails, a typed address is accepted so sign-up never blocks. The map link is built on read from the place id or coordinates, never stored. The storefront shows address, owner and "Cómo llegar"; the bot gets both in `bot/context`.

**Lesson:** Shell tools can collapse a double backslash. When a script must write the two characters backslash and n (the prompt stores line breaks that way), build them with `String.fromCharCode(92) + "n"`.

**Done:** The six columns on `tenants` were added with `prisma db execute`. **Open:** Set `GOOGLE_MAPS_API_KEY` (Places API (New) enabled), deploy, re-import `local-utils/n8n-chat-workflow-v2.json`, and test with a real key. Until the key is set, the address field falls back to typed text.

## 2026-10-26 — Dev — Vertical profile: tools, history labels and prompts per business type

**Decision:** One pure module (`src/lib/vertical-profile.ts`) decides what each vertical gets: orders, service-first catalog, the customer group name (patients, pets, travelers, customers), pets, and the Newy AI tool set. Sidebar, storefront, assistant, chat route and history screens read from it instead of comparing the vertical name. The chat route refuses tool calls outside the vertical's set on the server, not only through the prompt.

**Lesson:** Every verticals check used `=== "HEALTH"`, so VETERINARY and TOURISM were treated as stores in most screens. A single profile table prevents that drift.

**Open:** Pets (a `Pet` table and `Appointment.petId`) are approved but not built: they need two additive live DB changes and your OK. Until then a vet's history groups by the owner's phone. The triage page now has a menu link when `isTriageEnabled`.

## 2026-10-26 — Dev — Pets for veterinary and pet-care businesses

**Decision:** A real `Pet` table keyed by the owner's phone key, with a nullable `petId` on each appointment. Only `VETERINARY` and `PET_CARE` require a pet name; other verticals ignore it. The pet row is created inside the booking transaction, after the slot check, so a taken slot leaves no pet behind.

**Lesson:** Prisma selects every column of a model, so adding a schema field before its column exists breaks every read of that table. The DDL ran first, then the schema, then the client.

**Lesson:** Live checks read an empty database (no tenants, no users, no appointments) after an earlier check in the same session had read tenant rows. The pet checks did not run. Confirm which database the scripts use before trusting a result.

**Open:** Run `local-utils/check-pets.ts` and `local-utils/check-vertical-profile.ts` on a database with data; test a vet booking on the web and in the bot; re-import `local-utils/n8n-chat-workflow-v2.json`.

## 2026-10-26 — Dev — minimal-ui pass on recently changed screens

**Decision:** The codemod found nothing to change (all auto rules at 0). The 15 `shadow-lg` matches are modal and dropdown overlays, which the spec keeps. The credits badge card no longer tints its background on hover (cards change only the border). The sign-up modal is in `components/marketing` (dark brand), so it is out of scope and was not restyled.

**Open:** Visual check at 375 px and with a different primary color and font in `/admin/apariencia`.

## 2026-10-26 — Dev — Cloudinary root folder renamed to newaigent

**Decision:** The root folder changed from `nutriologas` to `newaigent` in Cloudinary (Admin API rename) and in code. The root is one constant (`src/lib/cloudinary-root.ts`) used by the tenant uploads, sign-up uploads, the banner renderer and the sign-up logo move. The owner agreed to delete the business data and recreate the accounts, so no database URLs were rewritten.

**Lesson:** Renaming a Cloudinary folder changes every public URL inside it. Any URL saved in the database breaks at that moment, so the rename and the data reset have to happen together.

**Open:** Delete the business rows (or the whole test tenant) and recreate them; the old logo and product URLs are invalid until then. Confirm which database the app uses before deleting anything.

## 2026-10-26 — Dev — minimal-ui pass on the storefront About section

**Decision:** Owner, address and directions are label/value rows with thin dividers. The description keeps the owner's own line breaks. The directions link uses neutral text with a tenant-colored underline, so it stays readable on light tenant colors.

**Lesson:** The description is free text. The list items on the About card run together because the owner typed them on one line. Fix it in the source: the owner adds line breaks in the Negocio description field, not in the page.

**Open:** Visual check at 375 px and with a light and a dark tenant primary color.

## 2026-10-26 — Dev — minimal-ui pass on storefront product cards and FAQ

**Decision:** The product name no longer clips because the price column stops squeezing it (`min-w-0`, `shrink-0`). The "Ver servicios" button uses the shared secondary style, because white text on a pale tenant primary is hard to read. The FAQ uses plain borders, medium weight and neutral icons.

**Open:** Visual check at 375 px and with a light and a dark tenant primary color. The product card also appears in the catalog, so check that page too.

## 2026-10-26 — Dev — Sign-up logo uploaded into the tenant folder

**Decision:** The logo is sent with the registration form and uploaded after the business exists, so no file is staged in a shared folder. The public upload route was removed.

**Lesson:** A staged upload before the owner exists always leaves a root-level folder behind. Moving the file afterward is not enough; the upload has to wait for the tenant.

**Open:** Delete the old `newaigent/signups` folder in Cloudinary once no sign-up is pending. Check a real sign-up with a logo in the browser.

## 2026-10-26 — Dev — WhatsApp pairing QR refreshes automatically

**Decision:** The status endpoint refreshes the stored QR from Evolution when it is older than 25 seconds, up to 8 times, then marks it expired and the modal offers a new code. The timing lives in `ConnectedApp.metadata`, so no schema change was needed.

**Lesson:** The poll compared against the stored QR, which was only written at connect time, so an expired code stayed on screen forever. The fix had to refresh on the server, not only on the client.

**Open:** Test with a real phone: wait past 25 seconds and check the code changes; wait past about 3 minutes and check the expired message and the regenerate button.

## 2026-10-26 — Newy AI can read the FAQs

**Done:** Added the `get_faqs` helper tool (tenant-scoped `fAQ` rows, active only, sorted by `sortOrder`) for every vertical, plus a line in the system prompt that sends FAQ questions to it. Checks: `tsc --noEmit` clean, `check-vertical-profile.ts` 19/19.

**Open:** In the chat, ask "cuáles son mis FAQs" on a tenant that has FAQs and confirm it lists them.

## 2026-10-26 — Newy AI tools: data limits and new helpers

**Done:** Removed patient email, visit notes and clinical notes from `get_appointments`; fixed clinic-time dates and times. Added the business, catalog, free-slot, confirmation-count and WhatsApp-count tools. Checks: `tsc --noEmit` clean, `check-vertical-profile.ts` 21/21, `check-newy-tools.ts` 10/10 read-only on the live DB.

**Open:** `get_appointments` with `period` "week" or "month" still uses the server clock through `getPeriodDates`. Test in the chat with a clinic that has appointments today.

## 2026-10-26 — Reminders: late bookings get the confirmation request

**Done:** `planReminder` (`src/lib/reminders.ts`) no longer treats a visit booked after the reminder time as confirmed. If the release deadline is still ahead, the request goes out on the next run and the visit can be released. If no time is left, nothing is sent. Checks: `local-utils/check-reminders.ts` updated with the 17:00 case (booked 12:44, deadline 15:00), `check-reminder-messages.ts` passes, `tsc --noEmit` clean.

**Found, not changed:** (1) A visit at 09:00 with a 2 h deadline and a 09:00 same-day send time has no room to answer, so it gets the plain reminder with no request. The owner should set an earlier send time; decision pending. (2) `POST /api/internal/bot/book` saves visits as status CONFIRMED before the customer answers, and the release check looks only at `customerConfirmedAt`, so an owner-confirmed visit can still be released. Decision pending.

**Open:** Test with a real phone and calendar: book a visit that is 3 hours away and check the request arrives within 15 minutes.

## 2026-10-26 — Reminders timed from the visit (lead hours)

**Done:** Replaced the day-before / same-day mode and fixed send time with `reminderLeadHours` (exact moment before the visit). The release stays `confirmationDeadlineHours` before the visit. Rules in `src/lib/reminders.ts`: a window under 30 minutes counts as confirmed; late bookings are due at once when the window allows an answer. Column added with `prisma db execute` (approved by the user; additive, default 24). Schema, run route, settings API, card, i18n, check scripts and docs updated. Checks: `tsc --noEmit` clean, `check-reminders.ts` and `check-reminder-messages.ts` pass, `check-reminders-dryrun.ts` run against the live database (dry run only, nothing sent).

**Open:** Existing tenants start at 24 hours; set lead and deadline in `/admin/whatsapp` before relying on the new timing. Real-phone test: lead 4 h, deadline 2 h, book a visit 5 h away; the request should arrive within 15 minutes of the 4-hour mark, and the visit should be released at the 2-hour mark without SI. Still pending: bot-booked visits saved as CONFIRMED, and owner confirmation not counting for release.

## 2026-10-26 — Bot introduces itself on first reply

**Done:** Added a prompt rule in `n8n/workflows/n8n-chat-workflow-v2.json` (Bot Agent): on the first reply of a conversation, introduce the business assistant; not again later. `Clean Reply` keeps an introduction ("soy el asistente…") instead of stripping the opening word. The checker passes with 0 problems.

**Open:** Re-import `n8n/workflows/n8n-chat-workflow-v2.json` in n8n and test with a new chat. The workflow file is not in git yet (see the secrets decision).

## 2026-10-26 — Office location in bot bookings and reschedules

**Done:** `bot/book` and `bot/reschedule` return `location` (the office address and map link, or null). The chat workflow prompt adds a "Ubicación:" line to the confirmation when that field has text. Checks: `tsc --noEmit` clean; checker 0 problems.

**Open:** Re-import the chat workflow in n8n and test a booking with an owner who has a physical location. Owner-confirmation and web confirmation messages do not include the location yet (not requested).

## 2026-10-26 — Bot greeting and introduction window

**Done:** `src/lib/greeting.ts` (pure): a plain greeting gets a fixed reply; the bot introduces itself when no message (bot or owner) was written to the contact in the last 12 hours. `bot/context` takes `text`, `customerPhone`, `remoteJid`, `remoteJidAlt` and returns `greetingReply` and `introRequired`. Chat workflow: `Get Bot Context` sends those fields; new `Guard: Greeting Reply` branch writes and sends the reply without calling the agent; the agent prompt takes PRESENTACION from `introRequired` instead of the model's history. Texts in `customerMessages.greetingIntro` / `greetingShort` (es, en). Checks: `local-utils/check-greeting.ts` passes, `tsc --noEmit` clean, checker 0 problems, the prompt renders for both flags.

**Open:** Re-import the chat workflow in n8n and test with a number that has no history, then with the same number after 12 hours (or a test chat). The tenant-editable greeting and the assistant name are for later (decided).
