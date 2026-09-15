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





