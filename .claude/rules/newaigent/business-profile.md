---
paths:
  - "src/app/admin/negocio/**"
  - "src/app/api/tenants/business/**"
  - "src/app/api/places/**"
  - "src/components/shared/AddressSearch.tsx"
  - "src/lib/phone.ts"
  - "src/lib/address-components.ts"
  - "src/lib/currency.ts"
  - "src/lib/time-zones.ts"
---

> Moved from `CLAUDE.md` on 2026-11-20. Loads only when a matching file is read.

## Business Profile (`/admin/negocio`)

- Route: `src/app/admin/negocio/page.tsx`
- API: `GET/PUT /api/tenants/business`
- Lets the admin edit: business name, logo (Cloudinary upload), WhatsApp number, business description (`businessInfo`).
- **The `slug` (subdomain) is read-only and must NEVER be editable** — it is the tenant's unique identifier; changing it would break the URLs.
- The form shows the current values as placeholders and an "Actual" (Current) label for each field.
- **The WhatsApp number is required** and is stored as `+<country code><digits>` (8 to 15 digits). It is used by WhatsApp, the reminders and the store button. The form has a country code selector (default +52) and the API validates it with `^\+\d{8,15}$`.
- **Location and owner**: "Ubicación y responsable" card with the owner's name, the "Mi negocio tiene un local físico" (My business has a physical location) switch and an address search (`src/components/shared/AddressSearch.tsx`, uses `/api/places/*` with `GOOGLE_MAPS_API_KEY`, server only). If the search is unavailable, the component falls back to a hand-typed address (without coordinates). The same component is used at signup (`OnboardingModal`).
- **Create `GOOGLE_MAPS_API_KEY`** (Google Cloud Console):
  1. Choose or create a project.
  2. Billing: link a billing account (Places requires it, although Google gives a free monthly amount).
  3. APIs & Services > Library: enable **Places API (New)** (not the older "Places API").
  4. APIs & Services > Credentials > Create credentials > API key.
  5. Restrict the key: under "API restrictions" choose only **Places API (New)** and **Time Zone API** (ticket #111: the business time zone is detected from the address; enable "Time Zone API" in APIs & Services > Library first). The key is used only from the server; Vercel has no fixed IP, so under "Application restrictions" leave "None".
  6. Save it without quotes: `.env` locally (restart `npm run dev`) and Vercel Environment Variables in production (redeploy).
  7. Create a budget alert in Billing to avoid unexpected charges.
  - Test: in `/admin/negocio`, turn on the switch and type an address; suggestions appear from 3 characters. If "La búsqueda no está disponible ahora" (Search is not available right now) appears, the key is missing, billing is off or the key is restricted to another API.
- **Call limit** of `/api/places/*`: 40 requests per minute per IP (`src/lib/rate-limit.ts`, in memory per server instance; it protects against abuse, it is not an exact limit).
- Phone helpers in `src/lib/phone.ts` (`buildFullPhone`, `splitFullPhone`, `PHONE_COUNTRIES`, `dialCodeForCountry`, `defaultDialCodeForZone`). Use them in any new form that asks for a phone; do not write another parser.
- **Country of the business (ticket #120, no column)**: `countryForTimeZone` (`src/lib/time-zones.ts`; each `TimeZoneOption` has a `country`, plus the Mexican zones Google returns that are not in the list) gives the country of `Tenant.timeZone`. From it come the first dial code of every phone field (Negocio when no number is saved, `/agendar`, Nueva cita, and the 10-digit completion of a staff WhatsApp in `normalizeStaffWhatsapp`) and the `currency` of `bot/context` (`currencyForTimeZone` in `src/lib/currency.ts`: MX MXN, US USD, CO COP, PE PEN, CL CLP, AR ARS, ES EUR). An unknown zone keeps +52 and MXN, as before. A saved number keeps its own dial code.
- **Signup city and country (ticket #120)**: `POST /api/places/details` also asks Google for `addressComponents` in the same call and returns `city`, `region` and `countryCode` (`placeParts` in `src/lib/address-components.ts`, null when missing). The signup modal fills City, Country and the dial code from the picked place; a dial code the owner changed by hand is not replaced. City and country are not sent or stored: the formatted address already names them. Tests: `tests/address-components.test.ts`, `tests/country-by-zone.test.ts`.

---
