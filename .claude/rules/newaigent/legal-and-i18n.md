---
paths:
  - "src/i18n/**"
  - "src/components/legal/**"
  - "src/app/*/terminos/**"
  - "src/app/*/privacidad/**"
  - "src/app/*/terms/**"
  - "src/app/*/privacy/**"
  - "src/lib/legal-entity.ts"
  - "src/app/*/registro/**"
---

> Moved from `CLAUDE.md` on 2026-11-20. Loads only when a matching file is read.

## Legal Pages and Signup Consent

- **Legal routes**: `/terminos` (Terms of Service) and `/privacidad` (Privacy Policy) available on the public storefront and the root domain.
- **Component**: `src/components/legal/LegalPageLayout.tsx` handles the responsive layout, branding and multilingual support.
- **Mandatory consent**: In `/registro` and in the onboarding modal (`OnboardingModal.tsx`), the user must tick the checkbox accepting the Terms and Privacy Policy before the account creation button is enabled.
- **Legal texts**: `src/components/legal/legalContent.ts` (Spanish and English; platform and each business). The business version receives its public data (`LegalSubject`: name, owner, address if there is a physical location, WhatsApp, and whether it handles health data). Do not put prices, plan limits or absolute guarantees in the text; point to the pricing page. Who operates NewAigent (legal name, address, privacy e-mail, retention period, jurisdiction) lives in `src/lib/legal-entity.ts` and is **empty**: an empty field is left out of the text. Fill it in and ask a lawyer to review before publishing. Check: `npx tsx local-utils/check-legal-content.ts`.
- **Notice when capturing data**: the booking flow (`BookingFlow`) asks for a checkbox with a link to `/privacidad` (and consent for health data at health businesses). The bot introduction includes the link to the notice.

---

## Internationalization (i18n) Architecture

- **Central hook**: `useTranslation()` from `@/i18n`.
- **Automatic detection**: Detects the main language configured in the user's browser (`navigator.languages[0]` / `navigator.language`), supporting Spanish (`es`) and English (`en`).
- **Typed dictionaries**: `src/i18n/types.ts`, `src/i18n/es.ts`, `src/i18n/en.ts`.
- **Zero hardcoded text**: All CRM views (including `/admin/social-campaign`, `/admin/pacientes`, modals, goal/tone/frequency selectors, alerts, placeholders and toasts) take their text from `t.crm.*`.
- **Bilingual legal routes**: `/terminos` and `/privacidad` are the Spanish routes; `/terms` and `/privacy` are the English alias routes. Both use the same `LegalPageLayout` with i18n.

---
