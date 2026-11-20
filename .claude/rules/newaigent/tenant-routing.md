---
paths:
  - "src/middleware.ts"
  - "src/lib/tenant.ts"
  - "src/lib/tenant-url.ts"
  - "src/app/layout.tsx"
  - "src/app/*/layout.tsx"
---

> Moved from `CLAUDE.md` on 2026-11-20. Loads only when a matching file is read.

## Multi-Tenant Architecture

### Tenant detection (middleware.ts)

The middleware detects the tenant from the hostname on every request:

```
localhost:3000         → Root domain (marketing page only)
newaigent.com          → Root domain (marketing page only)
www.newaigent.com      → Root domain (marketing page only)
doctor.newaigent.com   → tenant slug = "doctor"
clinic.newaigent.com   → tenant slug = "clinic"
myclinic.com           → custom domain → tenant slug = "myclinic.com"
doctor.localhost:3000  → tenant slug = "doctor" (local development)
```

The tenant slug is passed to server components through the `x-tenant-slug` header.

> **Status (2026-11-06):** the hostname rules above live in `resolveTenantSlug` (`src/lib/tenant.ts`) and are applied by the pages and APIs themselves. The old root `middleware.ts` never ran: with `src/app`, Next.js only reads `src/middleware.ts`. So no `x-tenant-slug` or `x-session-user` header is set, and nothing reads them. The current `src/middleware.ts` only gates `/admin` by role.

### Root domain security rules

The root domain (`newaigent.com`, `www.newaigent.com`, `localhost:3000`) is **ONLY** for the marketing page. No tenant route is available there.

The following routes are **blocked on the root domain** and return 404:

```
/admin, /login, /registro, /checkout, /carrito, /pedido, /mis-pedidos, /productos, /producto
```

Valid subdomains (`doctor.newaigent.com`) have full access to every route.

> **Not active today:** this block list was in the root `middleware.ts`, which never ran (see above), so these routes answer normally on the root domain. Turning it on (the list now also needs `/recuperar`) is a separate ticket: it changes behavior for every tenant and the Google sign-in callback lands on the root domain.

### Data isolation

- **All** database tables have `tenantId`
- All queries in `lib/` and API routes always filter by `tenantId`
- `tenantId` is taken from the NextAuth session token — never from user input
- The `x-session-user` header is cleared and rewritten by the middleware (to prevent spoofing)

---
