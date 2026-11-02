<!-- Generated: 2026-10-28 | Files scanned: 249 src + middleware + schema | Token estimate: ~650 -->
# Architecture

Single Next.js 14 App Router app, multi-tenant by hostname. One Postgres (Supabase) via Prisma. No monorepo.

## Request flow
```
browser/n8n/Evolution
   |
middleware.ts (93 lines)  host -> tenantSlug -> header x-tenant-slug
   |   strips client x-session-user, rewrites from JWT (getToken)
   |   root domain + tenant route -> /_not-found
   |   matcher skips: api/auth api/internal api/apps api/calendar _next
   v
src/app/(public)  storefront      src/app/admin  CRM (ADMIN only)
src/app/(auth)    login/registro  src/app/api    87 route handlers
   v
src/lib/*  (always filters by tenantId from JWT, never from input)
   v
db.ts (Prisma singleton) -> Postgres
```

## Boundaries
- Tenant = subdomain slug or customDomain. Root domain = marketing only.
- Auth: NextAuth v4 JWT carries id, role, tenantId (src/lib/auth.ts).
- Internal API (`/api/internal/*`): header `x-internal-key` = INTERNAL_API_KEY; callers are n8n workflows.
- Public-with-limit: `/api/places/*` (40 req/min/IP, src/lib/rate-limit.ts, in-memory).

## Subsystems
```
Storefront   products, cart (zustand), checkout (Conekta/PayPal), booking (BookingFlow)
CRM          dashboard, citas, productos, pedidos, whatsapp, social-campaign, apps, negocio
Newy AI      /api/chat -> openrouter cascade -> tools.ts -> execute-tool.ts (Prisma)
WhatsApp bot Evolution -> n8n agent -> /api/internal/bot/* (book, cancel, reschedule...)
Reminders    n8n cron 15min -> /api/internal/reminders/run (no LLM)
Campaigns    n8n -> /api/campaigns/social/due|context -> Meta Graph -> webhook ledger
Billing      Stripe subscription + AI credit top-ups; AiTokenLedger per month
```

## Cross-cutting
- i18n: src/i18n/{es,en,types}.ts, useTranslation(); no hardcoded UI text.
- Vertical profile: src/lib/vertical-profile.ts is the single source for per-giro behavior.
- Times: patient times are Mexico (-06:00) via clinic-time.ts; never suffix Z.
- Cloudinary root folder: newaigent/<tenantId>/<type>.
