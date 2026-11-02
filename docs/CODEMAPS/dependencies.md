<!-- Generated: 2026-10-28 | Files scanned: package.json + src/lib integrations | Token estimate: ~600 -->
# Dependencies

## External services
```
PostgreSQL (Supabase)   DATABASE_URL (6543 pooler), DIRECT_DATABASE_URL (5432)   lib/db.ts, Prisma 7 + adapter-pg
OpenRouter              OPENROUTER_API_KEY/MODELS cascade (free first, paid last)  lib/ai/openrouter.ts
Stripe                  subscriptions, AI credit recharge, webhook                  lib/stripe.ts, api/billing, api/credits
Conekta / PayPal        checkout                                                    lib/conekta.ts, api/checkout, webhooks/conekta
Cloudinary              uploads, banners  newaigent/<tenantId>/...                  lib/cloudinary*.ts, api/upload
Google Calendar         OAuth + events                                              lib/google-calendar.ts
Microsoft Graph         Outlook events (Calendars.ReadWrite)                        lib/microsoft-calendar.ts
Meta Graph (FB/IG)      campaigns publishing via n8n                                api/apps/oauth/facebook
Evolution API           WhatsApp send/receive, QR                                   lib/whatsapp.ts, lib/whatsapp-qr.ts
Google Places (new)     address search, server only GOOGLE_MAPS_API_KEY             api/places/*
n8n                     bot agent, reminders cron, social campaigns (calls /api/internal)
Upstash Redis           env declared; no src usage found (rate-limit.ts is in-memory)
```

## Key npm packages
next 14.2.29 · react 18.3 · next-auth 4.24 · @prisma/client 7.5 · stripe 22 · zod 3 · react-hook-form · zustand 5 · tailwindcss 3.4 · recharts · @fullcalendar/* · lucide-react · sonner · date-fns 4 · cloudinary · next-cloudinary · embla-carousel · react-easy-crop · react-markdown

## Scripts
dev, build, start (standalone), lint, db:{push,generate,seed,studio}. No test runner, no test script.
Tooling dirs: scripts/ (3 files), n8n/scripts/, n8n/docs/. local-utils/ (cited in CLAUDE.md) does not exist in this checkout.

## Docs
CLAUDE.md (source of truth, includes ECC Workflow section) · spec.md · n8n/docs/*.md · docs/DECISIONS-LEDGER.md · docs/CHANGELOG.md
