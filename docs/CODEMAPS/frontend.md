<!-- Generated: 2026-11-10 | Files scanned: 36 pages + 59 components | Token estimate: ~1050 -->
# Frontend

## Page tree (src/app)
```
(public)  /  productos  producto/[slug]  agendar/[slug]  carrito  checkout  mis-pedidos
          pedido/[id]  mis-citas  terminos|terms  privacidad|privacy
(auth)    login  registro  cambiar-contrasena (forced change, owner-set password)
admin     dashboard  citas  historial[/key]  productos  pedidos[/id]  carrusel  apariencia
          calendario(->citas)  reviews  asistente  faq  social-campaign[/setup]  whatsapp
          apps  negocio  pacientes(triage flag)  suscripcion  equipo (staff users)
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
            SessionWatch (admin layout; on each section change fetches /api/auth/session and redirects when access is locked)
            team/       TeamManager TeamUserRow NewTeamUserForm TempPasswordDialog useTeam (data hook)
auth/       ChangePasswordForm (used by cambiar-contrasena)
crm/        SalesChart AppointmentsChart ProductsChart RatingsChart CampaignMetrics CalendarView DashboardFilters
chat/       ChatAssistant AssistantThinkingIndicator
marketing/  landing sections + OnboardingModal (signup) SignInModal DemoModal
shared/     AddressSearch (Google Places via /api/places/*)
ui/         FilterChip (filter pill, text on primary via --on-primary)  RadioOption (flat radio row, 44px tap area on phones)
legal/      LegalPageLayout  order/ DownloadTicketButton PrintButton
```

## State and data
- /admin/citas opens on today (clinic date, `clinicDateKeyOf`); rows Fecha (date chips) and Estado (status chips) + search; KPI cards and status counts follow the chosen day (API `counts`); modality badge, age and Meet link per visit. `scrollbar-slim` (globals.css) for scrolling chip rows.
- /admin/citas shows the "reminder not delivered" badge via `lib/reminder-badge.ts` (active visit, failed attempts, no reminderSentAt, future date); text in t.agenda.*, neutral style, no technical reason.
- /admin/equipo: sidebar entry "Equipo" (AdminSidebar); TeamManager with data from useTeam, dialog TempPasswordDialog for temporary passwords.
- Cart: zustand store `src/store/cart.ts`. Toasts: `hooks/useToast.ts` (sonner).
- Server components read tenant via header `x-tenant-slug`; session via `lib/session.ts`.
- Client data: fetch to /api/*; forms use react-hook-form + zod.
- Theme: ThemeConfig -> CSS vars (--color-primary/secondary/accent, --on-primary, --font-family-base) via theme-vars.ts + ThemeProvider. Text on a `bg-primary` fill: `text-[color:var(--on-primary)]`, never `text-white`.
  Portaled components must set fontFamily var explicitly.
- i18n: `useTranslation()` from `@/i18n`; strings under `t.crm.*`.

## Style rules
- Flat minimal style (see .claude/skills/minimal-ui). No emojis; icons from lucide-react.
- Use tenant theme tokens, never hardcoded colors (marketing/ is exempt).
- Per-giro UI from `vertical-profile.ts` and `bookable.ts`, not by name checks.
