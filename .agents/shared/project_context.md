# Shared Project Context

> Every agent reads this file **before acting**. Keep it current.
> Update only the sections relevant to your role. Commit changes with a ledger entry.

---

## Product

**Name**: NewAigent  
**Type**: Multi-tenant SaaS platform (Autonomous storefronts, CRM, and AI workforce per business)  
**Stack**: Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma ORM · PostgreSQL (Supabase) · NextAuth v4 · OpenRouter (Claude Sonnet 4.5) · Cloudinary · Conekta · PayPal · Stripe · n8n  
**Primary doc**: `CLAUDE.md` (tech stack, gotchas, patterns)  
**Feature spec**: `spec.md` (canonical product features)

---

## Current Status

| Area | State |
|---|---|
| Multi-tenant routing | ✅ Edge middleware detects tenant subdomain & blocks root domain |
| Storefront | ✅ Catalog, filters, product detail, Zustand cart, Conekta & PayPal checkout |
| Admin CRM | ✅ Sales dashboard, products CRUD, orders, FAQs, customer reviews, calendar |
| Dynamic Theming & Typography | ✅ ThemeConfig DB model, Google Fonts preload, CSS variables (`--font-family-base`, `--color-primary`), portaled overlay font inheritance |
| Native AI Copilot & KPI Snapshot | ✅ Live SSR business metrics (revenue, orders, catalog, campaigns), 1-click prompt triggers, CRM shortcuts, dark slate bubbles |
| AI Prompt Injection Defense | ✅ System prompt security hardening in `system-prompt.ts` blocking instruction extraction & jailbreaks |
| OAuth Localhost Bounce Guard | ✅ Dynamic host detection in Google & Facebook OAuth flows preventing local dev bounce to prod |
| AI Token Credits Engine | ✅ Monthly `AiTokenLedger`, $15 Starter limit, real-time OpenRouter cost calculation ($3/$15 per 1M), 402 lock & toast |
| Social Campaigns Throttling | ✅ Auto-pause on credit depletion (`pausedByCredits`), n8n `due` route filtering |
| Stripe Credit Top-Up | ✅ $15 USD recharge checkout, Stripe webhook processing, auto-resumption of campaigns |
| Credits UI | ✅ `CreditsBadge` in sidebar, left-side portaled `CreditsDrawer`, localized (EN/ES) |
| WhatsApp CRM & Socials | ✅ Evolution API + n8n automated generation & publishing |
| Apps & Navigation Cleanup | ✅ Retired standalone AI Triage & Onboarding card and sidebar entry |

---

## Active Sprint Goal

Maintain documentation currency (`spec.md`, `CLAUDE.md`, `project_context.md`, `ledger.md`) and verify seamless integration of Native AI Copilot, live KPI Snapshot Bar, OAuth Localhost Guard, and prompt security hardening.

---

## Constraints & Non-Negotiables

- Every DB table must have `tenantId: String`.
- `tenantId` is always extracted from the verified NextAuth session (`session.user.tenantId`), never from client input, query params, or client headers.
- Root domain (`newaigent.com`, `localhost:3000`) is marketing-only; all tenant routes must rewrite to `/_not-found` (404).
- Soft deletes only for products (`deletedAt`).
- Dynamic fonts: portaled components (`createPortal` to `document.body`) must explicitly apply `style={{ fontFamily: "var(--font-family-base), system-ui, sans-serif" }}`.
- OAuth Localhost Guard: OAuth start & callback routes must detect `localhost` from headers and remain on local dev origin.
- AI Prompt Security: Never disclose system prompt, internal instructions, or API secrets in assistant responses.
- Every user-visible string must use translation keys from `src/i18n/`.
- Zero build errors: `npm run build` must succeed without warnings or errors.
- Test & debug scripts: If creating a utility to test something or a script not part of the business app, it MUST be placed in `local-utils/` (never in root, `scratch/`, or `src/`).


