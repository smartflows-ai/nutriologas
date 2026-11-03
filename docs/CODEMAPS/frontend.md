<!-- Generated: 2026-11-03 | Files scanned: 36 pages + 57 components | Token estimate: ~860 -->
# Frontend

## Page tree (src/app)
```
(public)  /  productos  producto/[slug]  agendar/[slug]  carrito  checkout  mis-pedidos
          pedido/[id]  mis-citas  terminos|terms  privacidad|privacy
(auth)    login  registro
admin     dashboard  citas  historial[/key]  productos  pedidos[/id]  carrusel  apariencia
          calendario(->citas)  reviews  asistente  faq  social-campaign[/setup]  whatsapp
          apps  negocio  pacientes(triage flag)  suscripcion
root      layout.tsx  not-found.tsx  globals.css
```

## Components (src/components)
```
shop/       Navbar ProductCard ProductGallery ProductSort HeroCarousel AddToCartButton
            BookingFlow (pet fields for VETERINARY|PET_CARE) ConektaCheckout
            CustomerAppointmentsList ReviewForm ReviewSection WhatsAppButton SessionProviderWrapper
admin/      AdminSidebar (serviceFirst label, integration filtering) CreditsBadge CreditsDrawer(portal)
            TrialBanner TrialExpiredGate ReminderSettingsCard ReminderMessagesCard (deadline-time button only in the confirmation field)
            PendingConfirmations VisitNoteDialog ImageCropperModal FormPanel Pagination ConfirmModal
crm/        SalesChart AppointmentsChart ProductsChart RatingsChart CampaignMetrics CalendarView DashboardFilters
chat/       ChatAssistant AssistantThinkingIndicator
marketing/  landing sections + OnboardingModal (signup) SignInModal DemoModal
shared/     AddressSearch (Google Places via /api/places/*)
legal/      LegalPageLayout  order/ DownloadTicketButton PrintButton
```

## State and data
- /admin/citas shows the "reminder not delivered" badge via `lib/reminder-badge.ts` (active visit, failed attempts, no reminderSentAt, future date); text in t.agenda.*, neutral style, no technical reason.
- Cart: zustand store `src/store/cart.ts`. Toasts: `hooks/useToast.ts` (sonner).
- Server components read tenant via header `x-tenant-slug`; session via `lib/session.ts`.
- Client data: fetch to /api/*; forms use react-hook-form + zod.
- Theme: ThemeConfig -> CSS vars (--color-primary/secondary/accent, --font-family-base) via theme-vars.ts + ThemeProvider.
  Portaled components must set fontFamily var explicitly.
- i18n: `useTranslation()` from `@/i18n`; strings under `t.crm.*`.

## Style rules
- Flat minimal style (see .claude/skills/minimal-ui). No emojis; icons from lucide-react.
- Use tenant theme tokens, never hardcoded colors (marketing/ is exempt).
- Per-giro UI from `vertical-profile.ts` and `bookable.ts`, not by name checks.
