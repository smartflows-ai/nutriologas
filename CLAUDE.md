# CLAUDE.md — NewAigent Multi-Tenant SaaS Platform

> Core rules only. This file is loaded on every message and by every subagent, so it stays small (target under 25 KB).
> Domain detail lives in `.claude/rules/newaigent/*.md`: each file loads by itself when a file under its `paths:` is read.
> Pending work, the production log and QA notes live in `docs/STATUS.md` (not loaded automatically).
> **When you add knowledge:** a feature's detail goes in its domain rule file; a dated status line ("applied to production on…", "QA …", "pending") goes in `docs/STATUS.md`. Never here.

## What is this application?

**NewAigent** is a multi-tenant SaaS platform that lets businesses (clinics, restaurants, stores, etc.) have their own online store, CRM and AI integrations — all in one shared system, yet completely isolated.

Each business (called a **tenant**) runs on its own subdomain:
- `doctor.newaigent.com` → Doctor clinic
- `nutrifit.newaigent.com` → Nutrition store
- `newaigent.com` → Marketing page only (NO access to any tenant route)

**Stack:** Next.js 14 · TypeScript · Tailwind CSS · Prisma ORM · PostgreSQL (Supabase) · NextAuth v4 · Anthropic Claude AI / OpenRouter · Cloudinary · Conekta · PayPal · Stripe · n8n · Upstash Redis

---
## Where the detail lives

| Topic | File | Loads when you read |
|---|---|---|
| Tenant detection, root domain, data isolation | `.claude/rules/newaigent/tenant-routing.md` | `src/middleware.ts`, `src/lib/tenant.ts` |
| Data models (Tenant, User, Product, Appointment, Pet, Order, ConnectedApp, PatientProfile, SocialCampaign, AiTokenLedger, Subscription) | `.claude/rules/newaigent/data-models.md` | `prisma/**`, booking, product, order and tenant APIs |
| AI credits, Newy AI copilot, n8n social campaigns, banner pipeline | `.claude/rules/newaigent/ai-credits-and-campaigns.md` | `src/lib/ai/**`, `src/lib/credits*.ts`, chat, credits, campaigns |
| Auth, live account check, team and staff users | `.claude/rules/newaigent/auth-and-team.md` | `src/lib/auth.ts`, `session.ts`, `permissions.ts`, `(auth)/`, `admin/equipo` |
| UI: tenant theme, form controls, status rows, minimal style | `.claude/rules/newaigent/ui-tenant.md` | any `.tsx`, `src/components/**` |
| WhatsApp bot (n8n), help requests (HITL), bot tools | `.claude/rules/newaigent/whatsapp-bot.md` | `api/internal/bot/**`, `src/lib/help-*.ts`, `admin/whatsapp` |
| WhatsApp sending, anti-ban, outbox, Evolution connection | `.claude/rules/newaigent/whatsapp-messaging.md` | `src/lib/messaging/**`, `src/lib/wa-*.ts`, `src/lib/whatsapp*.ts` |
| Appointment reminders and confirmation | `.claude/rules/newaigent/reminders.md` | `src/lib/reminder*.ts`, `api/internal/reminders/**` |
| Business time zone, `/ubicacion`, `/online/<code>` | `.claude/rules/newaigent/time-zone-and-short-links.md` | `src/lib/clinic-time.ts`, `time-zone*.ts`, `short-link*.ts` |
| Schema changes (manual SQL, up and down) | `.claude/rules/newaigent/schema-changes.md` | `prisma/**` |
| Environment variables, local multi-tenant dev, OAuth on localhost | `.claude/rules/newaigent/environment-and-local-dev.md` | `.env*`, `next.config.mjs`, `api/apps/oauth/**` |
| Business profile, address search, phone, country | `.claude/rules/newaigent/business-profile.md` | `admin/negocio`, `api/places/**`, `src/lib/phone.ts` |
| Meta, Microsoft Outlook, Cloudinary folders | `.claude/rules/newaigent/integrations.md` | calendar libs, `cloudinary*.ts`, `api/apps/**` |
| Legal pages, signup consent, i18n | `.claude/rules/newaigent/legal-and-i18n.md` | `src/i18n/**`, `src/components/legal/**`, `(legal)/` |
| Business verticals, pets, triage | `.claude/rules/newaigent/verticals-and-patients.md` | `vertical-profile.ts`, `(public)/**`, `admin/historial`, `admin/pacientes` |
| Agenda `/admin/citas` (create, edit, delete, restore) | `.claude/rules/newaigent/agenda.md` | `admin/citas`, `components/admin/appointments/**` |
| Directory map | `docs/claude/directory-structure.md`, `docs/CODEMAPS/` | read on demand |
| ECC details, `/n8n` command, n8n MCP server | `docs/claude/ecc-workflow.md` | read on demand |
| Team skills (`common-skills`) | `docs/claude/team-skills.md` | read on demand |
| Pending work, production log, QA notes | `docs/STATUS.md` | read on demand |

When a question is about one of these topics and no matching file has been read yet, read its rule file first instead of exploring the code.

---

## Non-negotiable rules (every task)

### Tenant isolation
- **All** tables have `tenantId`; every query in `lib/` and API routes filters by it. `tenantId` comes from the NextAuth session, never from user input.
- Guard with `session?.user`, never `!session` alone: Prisma ignores a filter whose value is `undefined`, so a route that goes on with a missing `tenantId` reads every business.
- The Prisma client is imported from `@/lib/db` (`src/lib/db.ts`), **NOT** from `@/lib/prisma`.
- The tenant comes from `resolveTenantSlug` (`src/lib/tenant.ts`). The old root `middleware.ts` never ran: no `x-tenant-slug` or `x-session-user` header exists, and `src/middleware.ts` only gates `/admin` by role. The root-domain route block list is not active.

### Data and time
- **Every appointment query filters `deletedAt: null`** (soft delete; `tests/appointments-soft-delete-guard.test.ts` fails otherwise). Delete features hide rows (`deletedAt`, `deletedById`); the app never erases them.
- A time chosen by a patient is the business's wall-clock time (`Tenant.timeZone`). Build it with `clinicDateTime(date, time, zone)` and read it with `clinicTimeOf(date, zone)` (`src/lib/clinic-time.ts`). Never a `Z` suffix or a fixed offset; `America/Mexico_City` and `-06:00` may appear only in `clinic-time.ts` and `time-zones.ts` (`tests/time-zone-guard.test.ts`).
- Social campaign dates are sent as `datetime-local`, never a bare `YYYY-MM-DD` (parsed as UTC midnight).
- **Never run `npm run db:push` against the real database**: it would drop n8n's `whatsapp_bot_memory` table. Never remove the `WhatsappBotMemory` model or add columns to it. A schema change is a `prisma/sql/<change>/` folder with `up.sql` and `down.sql`, a verified backup and human approval first, **database first, code after** (details: `schema-changes.md`). Local development uses the production database: treat every local write as a production write.

### Vocabulary and White-Labeling Standards

To maintain the platform's quality and commercial value, the following equivalences are mandatory in user interfaces and error messages. The right-hand column holds the literal user-facing strings, which stay in Spanish (the English gloss is in parentheses):

| Internal term / Provider | Commercial name visible to the user / customer |
|---|---|
| Claude / GPT / LLMs | **Newy AI** / Copiloto Newy AI |
| Evolution API | **WhatsApp** / Conexión Segura de WhatsApp (Secure WhatsApp Connection) |
| n8n | **Automatización Inteligente** / Flujos Automatizados (Smart Automation / Automated Flows) |
| Conekta | **Pasarela de pagos segura** / Tarjeta de crédito o débito (Secure payment gateway / Credit or debit card) |
| OpenRouter / Prompt tokens | **Créditos Newy AI** / Unidades de Inteligencia (Newy AI Credits / Intelligence Units) |

Brand rule: no internal provider name (Claude, Anthropic, OpenAI, GPT, OpenRouter, Evolution API, n8n, Baileys) may reach a customer or an admin, also in errors, stored failure reasons and API responses (`POST /api/chat` returns `modelUsed: "Newy AI"`).

### Human gate and re-route rules
Rescued from the old `.agents/` scaffold, because ECC has no equivalent. Applies to people and to any AI assistant working on this repo.

**Stop and get explicit human approval before:**
- Deploying to production (`vercel --prod`). No exceptions, even for a hotfix.
- Applying a schema change to the database. Never with `npm run db:push` against the real database (it would drop `whatsapp_bot_memory`): use the manual `up.sql` flow in "Schema changes", with a verified backup first.
- Any write to n8n (see the `/n8n` command below), any real WhatsApp message sent as a test, and any other outward-facing action (publishing to the public issue tracker, a commit or a PR the user has not asked for).
- Any action that destructively modifies or deletes database data.
- Escalating a P1 incident (the bot or booking is down for customers).

**Also non-negotiable** (in addition to the constraints above):
- No `dangerouslySetInnerHTML` on content that came from a user, a customer or the bot.
- `npm run build` must pass with zero errors before a change is approved for review.

**Re-route rules:**

| Situation | Action |
|---|---|
| `/ecc:code-review` asks for changes | Back to implementation with the review notes as input; review again. |
| Tests find a P1 bug | Fix first; no deploy until it is re-tested. |
| `/ecc:security-scan` finds a critical issue | Block the deploy, tell the user, fix it before anything else. |
| P1 incident in production | Treat it as a new requirement (ticket in the board), and tell the user right away. |

**Fast track** (skip the plan step, keep the review):
- Typo, copy or i18n-key-only change: implement, then `/ecc:code-review`.
- CSS token tweak or docs-only change: no plan, no new tests.
- Dependency bump: `/ecc:security-scan` first.
- Hotfix: implement, review, security scan, then the human gate above.

### Before touching anything
- Before the first edit, show the action list: files to create, modify or delete, commands with side effects, the reason for each, and what you will not touch. One approval covers that list; ask again only to go outside it. Database writes, n8n, commit, push, PR or merge, real sends and deleting or restoring data are always asked separately.
- **Unexpected state may be intentional.** The team wipes test data, applies SQL and merges without notice. Empty tables, deleted chats or rows, a migration already applied: report it as a finding with its consequence and ask. Never restore, re-create or "fix" it on your own.

### Public repo and secrets
- The repo is public. Never commit tokens, workflow JSON, screenshots with real names or phones, or anything under `local-utils/`.
- n8n: reads are free; any write (import, edit, activate) needs explicit approval in chat and a backup of the current workflow outside the repo (`~/.n8n-backups/`, owner-only) first. Never print raw workflow JSON. `/n8n` runs only when the user types it. Details: `docs/claude/ecc-workflow.md`.

### UI essentials (full rules in `ui-tenant.md`, loaded with any `.tsx`)
- No emojis in the UI; icons come from `lucide-react`, and an icon-only button has an `aria-label`.
- Tenant screens use theme tokens (`bg-primary`, `var(--color-primary)`, `text-[color:var(--on-primary)]` on a primary fill), never a hex value or a palette color such as `green-600`. Run `node local-utils/minimal-ui/audit.js` and `node local-utils/minimal-ui/theme-colors.js` before and after a tenant UI change.
- Every UI text comes from i18n (`useTranslation()`, `t.crm.*`), never hardcoded.
- A component portaled to `document.body` declares `style={{ fontFamily: "var(--font-family-base), system-ui, sans-serif" }}`.

### Multi-tenant rules (think about every business)
- Every change is designed as a rule for **any** tenant, not for the example shown in a screenshot. A screenshot is a case, not the specification.
- Do not write anything with the data of a specific business: labels, colors, verticals, product names or phrases.
- Free text from a business or the bot (appointment reason, notes, replies) is shown as is, respecting its line breaks. Do not parse its format from the screen: the format depends on what the bot or the customer writes. If the format matters, fix it at the source (bot prompt or booking flow).
- Before closing a UI change, check at least: an empty value, a long one, another vertical, dark mode and very light or very dark tenant colors.
- On delivery, state which rule was applied and which cases it covers.

---
---

## Workflow

### ECC (Everything Claude Code)
- Installed **only** as the plugin `ecc@ecc` (`.claude/settings.local.json`, hook profile `minimal`). Never run `install-apply.js` or `install.sh` on top of it. Rules: only `.claude/rules/ecc/common` and `.claude/rules/ecc/typescript`.
- Standard flow: `/ecc:plan-prd -> /ecc:plan (wait for CONFIRM) -> tdd-workflow skill -> /ecc:code-review -> /ecc:pr`. After writing a plan, open it with `/ecc:plan-canvas` and wait for the verdict; no code before approve or a confirmation in chat. `/ecc:build-fix` when the build breaks; `/ecc:security-scan` before shipping auth, payment or tenant code.
- This file wins over ECC rules: tenant isolation, `@/lib/db`, white label, i18n, no emojis, minimal UI and theme tokens are mandatory. TDD: write the failing test first; pure logic is tested in `tests/` with its I/O injected (see `src/lib/reminder-run.ts`). The "never mutate" rule applies to new code only.
- **Subagents reload every instruction file from scratch.** Do the work inline; delegate only when it does not fit in this context or the user asks for an agent.
- Browser checks: screenshots outside the repo or in a git-excluded folder, and stop before submitting any form (the user submits it).

## Useful Commands

```bash
npm run dev              # Development server at localhost:3000
npm run build            # Production build
npm run db:generate      # Regenerate the Prisma client
npm run db:push          # Apply the schema to the DB without a migration. NOT safe against the real database today (see "Schema changes")
npm run db:seed          # Create sample data
npm run db:studio        # Open Prisma Studio (DB UI)
vercel --prod            # Deploy to production

npx tsx --test tests/*.test.ts     # Automated tests (node:test, no database needed)
npx tsc --noEmit                         # Type check
npx tsx --env-file=.env local-utils/<script>.ts   # Scripts that touch the database: tsx does NOT load .env by itself
```

> ⚠️ **`npm run build` and `npm run dev` share the `.next` folder.** Running a build while the dev server is up breaks the dev server (CSS and chunks answer 404). Stop the dev server, or restart it with `rm -rf .next && npm run dev` afterwards. OAuth for Google and Facebook only works on port 3000 locally (the redirect URI is fixed to `http://localhost:3000`); Google also refuses to sign in from a browser driven by automation, so connect the calendar from your normal browser.
## Development Rules and Local Utilities

### Where tests and scripts live (`tests/` and `local-utils/`)
- **Tests** (`*.test.ts`, node:test) live in `tests/`, which is tracked and committed. Run them with `npx tsx --test tests/*.test.ts`. Pure logic goes there; I/O is injected so the tests need no database or WhatsApp.
- **Operator scripts** (checks against the database, simulators, one-off backfills, the minimal-ui audit) live in `local-utils/`. That folder is in `.gitignore` and is **never committed or pushed**. The repo is public, and these scripts reach the database or send WhatsApp messages.
- **STRICT RULE**: a utility that tests something, diagnoses the database, simulates API calls, or is not part of the production app goes in one of these two folders. Never in the project root (`./`), in untracked temporary folders such as `scratch/`, or in `src/`.
- Before any commit, PR or push, run `git diff --cached --name-only` and `git diff origin/main...HEAD --name-only`. Neither may list an added or modified path under `local-utils/`. A deletion (`D`) is allowed only when it untracks a file that used to be in git (how the legacy scripts leave the index). If an added or modified path appears, unstage it (`git restore --staged <file>`) and say so before committing.
- Never use `git add -f` on a `local-utils/` file. Never stage with `git add -A` or `git add .`: stage files by name.
- Status (2026-11-06): the test suites moved to `tests/`; the operator scripts are no longer tracked. Both changes are staged and not yet committed.
