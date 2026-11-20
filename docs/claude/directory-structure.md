> Moved from `CLAUDE.md` on 2026-11-20. Not loaded automatically: read it when the task needs it.

## Directory Structure

```
src/
  app/
    (public)/           ← Public tenant storefront
      page.tsx          ← Homepage (carousel + products + reviews + FAQ)
      productos/        ← Catalog with filters and service adaptation
      producto/[slug]/  ← Product or service detail + book-appointment CTA + reviews
      agendar/[slug]/   ← Interactive appointment / consultation flow with a 21-day picker and time slots
      mis-citas/        ← Patient/customer portal to view and cancel their appointments
      carrito/          ← Shopping cart (Zustand)
      checkout/         ← Payment gateway (Conekta + PayPal)
      mis-pedidos/      ← Customer order history
      pedido/[id]/      ← Order detail
    (legal)/            ← Own group, no storefront navbar or footer (LegalPageLayout draws its own header)
      terminos/         ← Terms of Service — Spanish
      privacidad/       ← Privacy Policy — Spanish
      terms/            ← Terms of Service — English locale alias
      privacy/          ← Privacy Policy — English locale alias
    (auth)/
      login/            ← Login with email/password + Google OAuth
      registro/         ← New customer signup (with legal consent)
      cambiar-contrasena/ ← A CRM user chooses their own password; the only screen a user with a temporary password can open
    admin/              ← CRM — only accessible with role = ADMIN
      dashboard/        ← Metrics: sales, orders, customers, today's appointments
      citas/            ← Management and schedule of medical/service appointments with clinical notes and statuses
      productos/        ← CRUD of physical products and services/consultations (duration, booking)
      pedidos/          ← Order management
      carrusel/         ← Banner/image carousel management
      apariencia/       ← Theme editor (colors + font)
      calendario/       ← Google Calendar and Outlook (Microsoft) integration
      reviews/          ← Customer review moderation
      asistente/        ← AI chatbot with Newy AI (tool use, appointment queries and KPIs)
      faq/              ← FAQ CRUD
      social-campaign/  ← Automated FB/Instagram campaigns (full i18n)
      whatsapp/         ← WhatsApp conversations CRM
      apps/             ← Integration management (Google, Microsoft, Facebook/Instagram Meta, WhatsApp)
      negocio/          ← Business profile (name, logo, WhatsApp, info) — does NOT include the slug
      equipo/           ← Team: the owner creates, resets, deactivates and activates staff users (ADMIN only)
      pacientes/        ← Patient/triage profiles (visible only if Tenant.isTriageEnabled = true)
      suscripcion/      ← Tenant Stripe subscription management
    api/
      appointments/     ← GET/POST tenant appointments (isolated by tenantId)
      appointments/[id] ← PATCH status, clinical notes and panel edits (service, time, patient details; never the phone); DELETE is a soft delete (ticket #103)
      appointments/[id]/restore ← POST: bring back a deleted visit (before its start time, never on top of another visit)
      appointments/services ← GET: bookable services for the "Nueva cita" form (no price)
      appointments/known-patient ← GET: name, age and email of a phone's latest visit, to prefill the form (rate limited)
      appointments/availability ← GET slot calculation based on schedule and duration: `allSlots` (every start time) and `availableSlots` (free ones); the booking page shows taken times as disabled
      auth/             ← NextAuth handlers ([...nextauth])
      products/         ← Products CRUD API
      orders/           ← Order creation and lookup
      pedido/[id]/      ← Public detail of a specific order
      checkout/         ← Payment processing (Conekta, PayPal)
      chat/             ← AI chatbot endpoint (streaming with Newy AI)
      campaigns/        ← Social campaigns API
      carousel/         ← Carousel images API
      faqs/             ← FAQs API
      reviews/          ← Reviews API
      theme/            ← Visual theme API
      apps/             ← Connection of external apps (Google + Facebook OAuth flows)
      calendar/         ← Google Calendar API proxy
      billing/          ← Stripe webhooks and subscription management
      credits/          ← AI credits API (GET status, POST Stripe recharge)
      internal/         ← Internal APIs for n8n and WhatsApp AI (authenticated with x-internal-key)
        tokens/report   ← POST: Report token consumption from external workflows
        render-post-banner ← POST: Compose a 1080×1080 banner with the Cloudinary SDK for campaigns
        triage/         ← GET/POST: Look up and save a patient profile from WhatsApp AI
        tenant-context/ ← POST: Full tenant context for the WhatsApp agent (products, FAQs, reviews, waConfig)
        calendar/       ← GET availability / POST create-event from n8n
        whatsapp/sync   ← POST: Sync WhatsApp messages from Evolution API
        bot/            ← POST: WhatsApp agent tools (context, availability, book, my-appointments, cancel, reschedule, alert-failure)
        campaigns/alert-failure ← POST: Notifies the owner via WhatsApp when a social campaign fails to publish
        places/search   ← POST (public, rate-limited per IP): Google Places address suggestions
        places/details  ← POST (public, rate-limited per IP): address and coordinates of a place
        reminders/run   ← POST: Sends reminders, charges for each one and releases unconfirmed appointments (every 15 min from n8n, no LLM). Answers 502 when every attempted send failed; body `{ dryRun: true }` lists the work without acting
      admin/pacientes   ← GET: List of PatientProfiles for the CRM (filtered by tenantId)
      admin/users       ← GET/POST the business staff users; `[id]` PATCH reset_password | deactivate | activate (permission `users.manage`, ADMIN only)
      auth/password-change ← POST: a signed-in CRM user changes their own password (the only API open to a temporary password)
      tenants/          ← Tenant management API
      tenants/business/ ← GET/PUT business profile. Slug is read-only.
      upload/           ← Image upload to Cloudinary
      webhooks/         ← Conekta and WhatsApp Evolution API webhooks
      webhooks/social-campaign ← POST: n8n notification when a post is published (deducts tokens from the ledger)
  components/
    shop/               ← Public storefront components
    admin/              ← CRM components:
      AdminSidebar      ← Side navigation with collapse and dynamic filtering by integration
      CreditsBadge      ← AI credits bar in the sidebar
      CreditsDrawer     ← Credits detail panel (portaled to document.body)
      TrialBanner       ← Active trial period banner
      TrialExpiredGate  ← Blocks CRM access when the trial expires
      AmazonCheckout    ← Alternative Amazon-style checkout UI
      ImageCropperModal ← Image crop modal
      Pagination        ← Reusable pagination component
    chat/               ← CRM chatbot (ChatAssistant, AssistantThinkingIndicator)
    crm/                ← Dashboard visualization components:
      SalesChart, AppointmentsChart, CampaignMetrics, ProductsChart, RatingsChart
      CalendarView      ← Interactive calendar view
      DashboardFilters  ← Dashboard filters
    order/              ← DownloadTicketButton, PrintButton (order view)
    marketing/          ← NewAigent landing page components
    legal/              ← Legal components (LegalPageLayout)
    ui/                 ← Reusable UI components
  i18n/                 ← Internationalization system (useTranslation, en.ts, es.ts, types.ts)
  hooks/
    useToast.ts         ← Custom hook for toasts
  lib/
    ai/                 ← Newy AI / OpenRouter tools, dynamic system prompt
      openrouter.ts     ← Model cascade + computeTokenCost
      tools.ts          ← CRM tool definitions (sales, orders, products, etc.)
      execute-tool.ts   ← Tool executor with Prisma (always filtered by tenantId)
      system-prompt.ts  ← Newy AI system prompt with anti-jailbreak defense
    credits.ts          ← Token accounting engine, limits and auto-pause
    credits-error.ts    ← CreditExhaustedError (402 error)
    trial.ts            ← Subscription state helpers (getTrialDaysLeft, isTrialExpired, etc.)
    auth.ts             ← NextAuth configuration (providers, callbacks, JWT)
    db.ts               ← Prisma client singleton (import as @/lib/db)
    cloudinary.ts       ← Cloudinary helper
    conekta.ts          ← Conekta helper
    stripe.ts           ← Stripe helper
    connected-apps.ts   ← Helpers for ConnectedApp queries
    google-calendar.ts  ← Full Google Calendar integration
    tenant.ts           ← Tenant helpers (getBySlug, getByDomain)
    session.ts          ← Helper to extract the session in server components
    utils.ts            ← General utilities
    validations/        ← Zod schemas
    image/              ← Image processing utilities
  store/                ← Zustand stores (shopping cart)
  types/                ← TypeScript type augmentations (NextAuth JWT)
prisma/
  schema.prisma         ← Full data models
  sql/                  ← Manual schema changes, one folder per change with up.sql and down.sql (see "Schema changes")
tests/                ← Tests (`*.test.ts`, node:test, tracked). local-utils/ ← operator scripts, simulators and diagnostics: in .gitignore, never committed

src/middleware.ts       ← /admin gate by role (src/lib/permissions.ts). The root-domain rules are not active (see "Root domain security rules")
```

> ⚠️ **Critical note for agents**: The Prisma client singleton is imported from `@/lib/db` (file `src/lib/db.ts`), **NOT** from `@/lib/prisma`. Using the wrong path causes module errors.

---
