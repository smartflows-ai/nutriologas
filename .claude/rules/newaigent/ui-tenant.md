---
paths:
  - "src/app/**/*.tsx"
  - "src/components/**"
  - "src/app/globals.css"
  - "tailwind.config.*"
  - "src/lib/theme-vars.ts"
  - "src/lib/tenant-metadata.ts"
---

> Moved from `CLAUDE.md` on 2026-11-20. Loads only when a matching file is read.

## Dynamic Theming and Custom Typography

The system respects the colors and typography configured by each business in `/admin/apariencia` (`ThemeConfig`):
- **CSS variables**: Injected in `:root` as `--color-primary`, `--color-secondary`, `--color-accent` and `--font-family-base`.
- **Google Fonts**: Pre-loaded in `src/app/layout.tsx` (`Inter`, `Montserrat`, `Playfair Display`, `Roboto`, `Space Grotesk`).
- **Tailwind**: Configured with `colors.primary = "var(--color-primary)"` and `fontFamily.sans = ["var(--font-family-base)", ...]`.
- **Link previews (ticket #116)**: on a business subdomain, `generateMetadata` in `src/app/layout.tsx` describes the page with `tenantPreview` (`src/lib/tenant-metadata.ts`, tests `tests/tenant-metadata.test.ts`): title = business name, description = the start of `businessInfo` (else "Bienvenido a <name>"), `og:image` = the logo, else the first active carousel image or service photo (a hosted image is served as a jpg of at most 600 px), `og:url` = the business address, `og:locale` = `es_MX` or `en_US`. Everything follows `Tenant.messageLanguage`, never the request: the WhatsApp preview reader sends no Spanish `accept-language`, so the old text came out as "Welcome to …". The business 404 page uses the same language (`getBusinessTranslationServer` in `src/lib/tenant-language.ts`). `<html lang>` still follows the browser, like the UI. The root domain keeps the NewAigent metadata. WhatsApp caches previews: test a new one with `?v=2`.
- **Portaled modals and drawers**: Any component that uses `createPortal(..., document.body)` (such as `CreditsDrawer`) must explicitly declare `style={{ fontFamily: "var(--font-family-base), system-ui, sans-serif" }}` so it does not lose the tenant's custom typography when escaping the layout.

---


### Save buttons in settings cards
- The save button of every settings card goes on the right (`flex ... justify-end`), the same as `ReminderSettingsCard` and the team forms. Never left-aligned, even in a short card with one field. A status message ("Saved") sits beside the button, on its right side too.
- Check it in the screen: the card's button and the other cards' buttons must share the same edge.

### Form controls (use the shared classes, never a new one)
- Text and number fields use the global class `input` (`src/app/globals.css`). Do not write a field class of your own.
- The main "create" button of a CRM section (Nueva cita, Nuevo servicio, FAQ, carrusel, campañas, equipo) is `btn-primary inline-flex items-center gap-2 min-h-11 sm:min-h-0 shrink-0` with an 18 px icon (ticket #116). `btn-primary` takes its text color from `--on-primary`, so a screen never adds `text-white` to it.
- Dropdowns use `select.input` (or `select-themed`): the same field with a chevron, and hover and focus in the tenant's primary color. A select with no such class is a bug.
- A numeric setting uses `NumberField` (`src/components/ui/NumberField.tsx`): the text stays the person's while they type, so an empty or partial value is never saved as 0 and "01" never appears. Never write `value={Number(...)}` with `onChange` calling `Number(e.target.value)`; that is the bug this component fixes. Its validation is tested in `tests/number-field.test.ts`.
- Two settings in the same screen that ask for a duration use the same control and the same unit style: "Send the reminder (hours before the visit)" and "Minutes before telling the owner" are both a number field.
- Before closing a form change, compare it with a field of a nearby card (same width, same label style, same alignment of its button).

### Status in lists and rows (chats that need a person, WhatsApp)
- Color is never the only signal. Every status has an icon and a word (or an accessible label). Priority colors come from `src/components/admin/whatsapp/helpTone.ts` (`HELP_BAR_CLASS`, `HELP_TEXT_CLASS`, `HELP_COUNT_CLASS`): red for high, amber for medium, and near-black amber text on amber, never gray text on a color.
- A row has three lines at most: the name, one status line (reason and waiting time, `HelpRowBadge`), and the preview. Do not add a fourth line or a second text tag to the name line; the sidebar is about 320 px wide and tags collide.
- Per-person states that are not the reason of the row (in my charge, the customer wrote again) are icon badges on the avatar, with an accessible label and a tooltip: primary for "in my charge", red with a message icon for "wrote again". The words also appear in the open chat's banner. Do not tint these badges (the audit flags tinted panels).
- A notice that interrupts (the assignment toast) is a small card in the bottom-right corner, shows the name, the reason and one action, closes by itself after 15 seconds and has a close button. It never shows the customer's message.
- Filters are `FilterChip`s above the list: All, Need help (count), In my charge (count). A filter never hides a chat that the priority order would show first.
- The list order is decided in one place: help priority, then the viewer's chats, then other assistants' chats, then unassigned ones, most recent first (`src/lib/chat-order.ts`). A group separator is not used, because it would split the priority levels.
- Check the row at the width of the sidebar, with a long name, with two badges at once, with a light and a very dark tenant color, and in dark mode.

### No emojis in the UI
- **NEVER** use emoji characters (`📋`, `✅`, `⚠️`, `⭐`, `🚀`, etc.) as UI elements in JSX/TSX.
- All icons must come from `lucide-react`. Always specify the component name, size (`size`) and `strokeWidth` when relevant.
  - Correct: `<AlertTriangle size={16} className="text-amber-500" />`
  - Incorrect: `⚠️ Warning`
- Icon-only buttons must include `aria-label` for accessibility.

### Minimalist style on tenant screens
- Tenant screens (CRM, storefront, login/signup) follow a flat, neutral style, like Claude or ChatGPT. The rules are in `local-utils/minimal-ui/config.js` (auto token swaps and flagged patterns); check with `node local-utils/minimal-ui/audit.js` (read-only).
- No gradients, blur, colored shadows, hover scaling or uppercase labels. The tenant's colors and font are kept.
- To audit or rewrite styles use the `minimal-ui` skill (scripts in `local-utils/minimal-ui/`).
- The dark NewAigent brand pages (landing, legal, billing, 404) are not covered by this style.
- **Run both checks before writing any tenant UI, and again before closing it:**
  - `node local-utils/minimal-ui/audit.js`: decorative style (radius, shadows, uppercase, gradients).
  - `node local-utils/minimal-ui/theme-colors.js`: hardcoded colors. **FAIL** = a brand-like palette color (`green-600`, `emerald-50`, `blue-600`, ...) or a hex value on a tenant screen; exit code 1. **WARN** = red status colors (errors), reviewed by hand. Neutrals (gray, slate, zinc, white, black) are allowed. SVG brand marks are ignored.
  - Both are read-only. Report the output for the files you touched: each FAIL is fixed or justified, each WARN is reviewed.
  - Existing screens have FAILs from before these checks (for example status badges on `(public)/mis-pedidos` and `admin/negocio`). The rule applies to every new or changed line; clean up the old ones when you touch those files.

### Follow the tenant's style (theme in the database)
- **Text on a primary fill**: never `text-white` on `bg-primary`. Use `text-[color:var(--on-primary)]`: `--on-primary` is set with the rest of the theme (`themeColorVars` and `readableTextOn` in `src/lib/theme-vars.ts`, tests in `tests/theme-vars.test.ts`) and is **white for every tenant today** (product decision of 2026-11-11, `src/lib/theme-vars.ts`; `readableTextOn` exists but is not applied). On a very light tenant color (for example a pale pink) white text is hard to read; changing that means revisiting the decision, not the components. Shared pieces: `src/components/ui/FilterChip.tsx` (filter pills) and `src/components/ui/RadioOption.tsx` (radio rows, 44px tall on phones). `scrollbar-slim` (globals.css) gives a chip row a thin scrollbar in the tenant's primary color. Not yet swept: about 29 older `bg-primary ... text-white` uses in apps, pacientes, pedidos, productos, reviews, social-campaign, whatsapp, Pagination, ChatAssistant, CalendarView, Navbar and ProductCard.
- Every new page or component of the **public storefront** (`(public)/`) and the **CRM** (`admin/`) must respect the tenant's visual theme stored in the `ThemeConfig` table (`primaryColor`, `secondaryColor`, `accentColor`, `fontFamily`).
- The theme is injected as CSS variables from the tenant layout. Always use `var(--color-primary)` / `bg-primary` / `text-primary` and the configured Tailwind utilities — **never** hardcoded color values (`#16a34a`, `green-600`, etc.) in tenant components.
- In **marketing page** components (`marketing/`), fixed colors are allowed because they do not belong to any tenant.
- If a new component needs an accent color different from the tenant's, it must expose it as a prop or CSS token — not hardcode it.
- The color check is `node local-utils/minimal-ui/theme-colors.js` (see "Minimalist style on tenant screens"). A UI change is not done until it has no new FAIL.
- Before closing any UI change, check and state the result: empty value, long value, dark mode, very light and very dark tenant colors (the white text on `bg-primary` must stay readable), and another vertical when it applies.
