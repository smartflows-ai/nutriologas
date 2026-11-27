---
paths:
  - ".env*"
  - "next.config.mjs"
  - "prisma.config.ts"
  - "src/app/api/apps/oauth/**"
---

> Moved from `CLAUDE.md` on 2026-11-20. Loads only when a matching file is read.

## Critical Environment Variables

```bash
# ─── Database ───────────────────────────────────────────────────────────────────
DATABASE_URL=                    # PostgreSQL on Supabase (pooler port 6543 — runtime)
DIRECT_DATABASE_URL=             # Same URL but port 5432 — required for prisma db push / migrate

# ─── Auth ───────────────────────────────────────────────────────────────────────
NEXTAUTH_SECRET=                 # openssl rand -base64 32
NEXTAUTH_URL=                    # http://localhost:3000 (dev) | https://newaigent.com (prod)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ─── Microsoft OAuth (Outlook Calendar) ─────────────────────────────────────────
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=             # "common" for multi-tenant Microsoft

# ─── AI (Newy AI / OpenRouter) ──────────────────────────────────────────────────
ANTHROPIC_API_KEY=               # Claude API (direct fallback)
OPENROUTER_API_KEY=              # OpenRouter API key (primary)
OPENROUTER_MODEL=                # Primary model: anthropic/claude-sonnet-4.5
OPENROUTER_MODELS=               # Full cascade, comma-separated (see §2 Model stack)
OPENROUTER_REQUIRE_ZDR=          # true requires zero-retention endpoints (can leave a model without an endpoint)
OPENROUTER_INPUT_PRICE_PER_M=    # 3.00 (USD / 1M prompt tokens — retail rate)
OPENROUTER_OUTPUT_PRICE_PER_M=   # 15.00 (USD / 1M completion tokens — retail rate)
REMINDER_COST_USD=               # 0.0085 (USD charged to the tenant for each reminder sent)
REMINDER_PROVIDER_COST_USD=      # 0 (real cost per reminder; set equal to Meta's after migrating)

# ─── Google Maps (business address) ─────────────────────────────────────────────
GOOGLE_MAPS_API_KEY=             # Server only; Places API (New) enabled and key restricted to that API

# ─── Root domain (multi-tenant) ─────────────────────────────────────────────────
NEXT_PUBLIC_ROOT_DOMAIN=         # newaigent.com

# ─── Payments — Conekta ─────────────────────────────────────────────────────────
CONEKTA_PRIVATE_KEY=             # Server-side
NEXT_PUBLIC_CONEKTA_PUBLIC_KEY=  # Client-side (Conekta.js tokenization)
CONEKTA_WEBHOOK_SECRET=
CONEKTA_SUCCESS_URL=             # Redirect URL after a successful payment
CONEKTA_FAILURE_URL=             # Redirect URL after a failed payment

# ─── Payments — PayPal ──────────────────────────────────────────────────────────
PAYPAL_CLIENT_ID=                # Server-side
PAYPAL_CLIENT_SECRET=            # Server-side
NEXT_PUBLIC_PAYPAL_CLIENT_ID=    # Client-side SDK

# ─── Stripe (Platform SaaS Billing) ─────────────────────────────────────────────
STRIPE_SECRET_KEY=               # sk_test_... or sk_live_...
STRIPE_WEBHOOK_SECRET=           # whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # pk_test_... or pk_live_...
STRIPE_PRICE_STARTER_MONTHLY=    # price_...
STRIPE_PRICE_STARTER_ANNUAL=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_ANNUAL=
STRIPE_PRICE_STARTER_MONTHLY_DLLS=  # USD variant
STRIPE_PRICE_STARTER_ANNUAL_DLLS=
STRIPE_PRICE_PRO_MONTHLY_DLLS=
STRIPE_PRICE_PRO_ANNUAL_DLLS=

# ─── Cloudinary (images) ────────────────────────────────────────────────────────
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=   # Client-side (direct uploads)
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ─── Facebook / Instagram OAuth (social campaigns) ──────────────────────────────
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
# FACEBOOK_REDIRECT_URI is auto-detected from NEXTAUTH_URL if not defined

# ─── n8n Automation ─────────────────────────────────────────────────────────────
N8N_FACEBOOK_WEBHOOK_URL=        # n8n webhook URL to trigger publications
# Only read by the /n8n command (read-only inspection of the n8n instance), never by the app:
N8N_API_URL=                     # https://<your-n8n-host>/api/v1  (no trailing slash)
N8N_API_KEY=                     # n8n > Settings > n8n API. Without Enterprise it has full access: treat it as a secret

# ─── Internal APIs (n8n → Next.js) ──────────────────────────────────────────────
# IMPORTANT: All endpoints under /api/internal/ verify this header: x-internal-key
INTERNAL_API_KEY=                # openssl rand -hex 32
# Note: .env.example names it INTERNAL_API_KEY (the name the code reads). Do not use INTERNAL_API_SECRET

# ─── WhatsApp Evolution API ─────────────────────────────────────────────────────
EVOLUTION_API_URL=              # https with a valid certificate (the app no longer accepts invalid certs)
EVOLUTION_API_KEY=              # Global key: server-side only, for create/fetchInstances. Never stored in the DB
EVOLUTION_WEBHOOK_SECRET=       # Evolution signs each webhook with a 10-min JWT (jwt_key header); the n8n trigger verifies it. openssl rand -hex 32, same value in n8n

# WhatsApp files in the panel (ticket #182). Without the five WA_MEDIA_STORE_* the store is "not configured" and nothing is attempted
WA_MEDIA_ENABLED_TENANTS=        # business ids that are on, comma separated; empty = off for everyone
WA_MEDIA_PLATFORM_MAX_BYTES=     # bytes the whole platform may hold; missing or invalid = 1073741824 (1 GB)
WA_MEDIA_STORE_ENDPOINT=         # S3 endpoint of the private store (https; http only on this machine). Its origin is added to img-src and media-src
WA_MEDIA_STORE_REGION=
WA_MEDIA_STORE_BUCKET=           # private bucket, 16 MB per file; use a separate bucket ending in -test for local tests
WA_MEDIA_STORE_ACCESS_KEY_ID=    # key limited to the store, never the database key
WA_MEDIA_STORE_SECRET_ACCESS_KEY=
PLATFORM_WA_INSTANCE=            # NewAigent's own instance: account messages such as the password reset code (src/lib/platform-whatsapp.ts). Without it no code is sent and /recuperar still answers ok
PLATFORM_WA_INSTANCE_TOKEN=     # That instance's own token (optional; falls back to the global key)

# ─── Redis / Upstash (session cache) ────────────────────────────────────────────
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

> ⚠️ **Windows `.env` rule**: Do not put quotes around the values.
> ⚠️ **INTERNAL_API_KEY**: Endpoints under `/api/internal/` read `process.env.INTERNAL_API_KEY`. If your `.env` defines it as `INTERNAL_API_SECRET`, the `x-internal-key` header will fail with a silent 401/403.

---


## Local Development with Multiple Tenants

To test subdomains locally, edit the system `hosts` file:

```
127.0.0.1  localhost
127.0.0.1  doctor.localhost
127.0.0.1  nutrifit.localhost
127.0.0.1  nutriologas.localhost
```

Then open `http://doctor.localhost:3000` to see the "doctor" tenant.

### Local OAuth protection (`OAuth Localhost Guard`)
- **Previous problem**: When connecting Google Calendar or Facebook from `doctor.localhost:3000`, the app redirected to `https://doctor.newaigent.com/...` in production because `.env` contained `NEXTAUTH_URL="https://newaigent.com"`.
- **Implemented solution**: The endpoints `/api/apps/oauth/google/start`, `/callback`, `/api/apps/oauth/facebook/start` and `/callback` automatically detect the `host` header. If it contains `localhost`:
  - They set `redirect_uri` to `http://localhost:3000/api/apps/oauth/<provider>/callback`.
  - In the callback, the final redirect is built dynamically as `http://${slug}.localhost:3000/admin/...`, ensuring local development always stays on `localhost:3000` without altering production environment variables.

---

### A local app on a copy of the database still reaches real WhatsApp and the real calendar

A local copy of the database isolates the data, not the connections: the rows it copies hold working keys.

- The send pauses (`platform_flags.globalKillSwitch`, `tenants.whatsappKillSwitch`) stop sends only. Connect, disconnect, QR, settings and webhook calls still reach the real WhatsApp connection server, and the instance name is always `<slug>-<tenantId>`: on 2026-11-26 a click on "Desconectar" in `/admin/apps` of a local app called the real server (harmless that day, the line was already gone in production). With a line connected in production the same click drops it.
- Start a local app that runs on a copy with `EVOLUTION_API_URL` and `EVOLUTION_API_KEY` empty in the process: the adapter then answers "not available" and touches nothing. Nobody opens `/admin/apps` or uses connect or disconnect there, and nobody books, moves or cancels visits (the copy holds a working calendar connection).
- `/admin/whatsapp` shows "WhatsApp no conectado" and hides every chat when the business has no WhatsApp row in `connected_apps`. A local copy without that row needs a placeholder row (an invented instance name) to open the chats.
- A worktree `.env` copied from the main folder carries the real database and connection values; only the variables of the process hide them. A script that writes must refuse to run when the database is not the copy.

