// tests/qa-18-nov-wiring.test.ts
// Reads the source (no database) to check the screens and routes use the shared rules of this round
// (tickets #113, #116, #120) instead of fixed values. Run with: npx tsx --test tests/qa-18-nov-wiring.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel: string): string => readFileSync(path.join(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

test("the phone forms start from the country of the business zone, not a fixed +52 (#120)", () => {
  for (const rel of ["src/components/shop/BookingFlow.tsx", "src/components/admin/appointments/useAppointmentForm.ts"]) {
    const src = read(rel);
    assert.doesNotMatch(src, /useState\(DEFAULT_DIAL_CODE\)/, rel);
    assert.match(src, /defaultDialCodeForZone\(zone\)/, rel);
  }
  // Negocio keeps a saved number's dial code and uses the zone only when there is none.
  assert.match(read("src/app/admin/negocio/page.tsx"), /setDialCode\(currentWhatsapp \? dial : defaultDialCodeForZone\(tenantData\.timeZone\)\)/);
  assert.match(read("src/app/api/admin/users/[id]/route.ts"), /defaultDialCodeForZone\(await getTenantTimeZone\(guard\.tenantId\)\)/);
  assert.match(read("src/app/api/admin/users/[id]/route.ts"), /setStaffWhatsapp\(staffDeps\(\), actor, id, raw\.whatsappNumber, dialCode\)/);
});

test("the bot currency is not fixed to MXN (#120)", () => {
  const src = read("src/app/api/internal/bot/context/route.ts");
  assert.doesNotMatch(src, /currency: "MXN"/);
  assert.match(src, /currencyForTimeZone\(bot\.timeZone\)/);
});

test("place details read the address components in the same call, and the signup modal uses them (#120)", () => {
  assert.match(read("src/app/api/places/details/route.ts"), /"X-Goog-FieldMask": "id,formattedAddress,location,addressComponents"/);
  const modal = read("src/components/marketing/OnboardingModal.tsx");
  assert.match(modal, /setCity\(placeLocation\.city\)/);
  assert.match(modal, /if \(!dialTouched\) setDialCountry\(country\)/);
  // City and country are still not sent with the signup.
  assert.doesNotMatch(modal, /\bcity: city\b|\bcountry: selectedCountry/);
});

test("every way of creating a visit checks the full name (#113)", () => {
  assert.match(read("src/app/api/appointments/route.ts"), /isPlausibleFullName\(clientName\)/);
  assert.match(read("src/app/api/internal/bot/book/route.ts"), /isPlausibleFullName\(patient\.name\)/);
  assert.match(read("src/lib/appointment-admin-rules.ts"), /isPlausibleFullName\(name\)/);
  assert.match(read("src/components/shop/BookingFlow.tsx"), /isPlausibleFullName\(name\)/);
});

test("the panel form no longer offers or sends booking for another person (#113)", () => {
  const form = read("src/components/admin/appointments/AppointmentFormPanel.tsx");
  const live = form.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  assert.doesNotMatch(live, /set\.forOther/);
  assert.doesNotMatch(read("src/components/admin/appointments/useAppointmentForm.ts"), /forOtherPerson: forOther/);
});

test("the card asks the server rule before offering Recuperar or Reabrir (#113)", () => {
  const card = read("src/components/admin/appointments/AppointmentCard.tsx");
  assert.match(card, /onRestore && canOfferRestore\(/);
  assert.match(card, /canOfferReopen\(appt\.status,/);
});

test("business pages describe themselves in the business language (#116)", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /tenantPreview\(/);
  // The page language stays the UI language (accessibility); the preview carries the business locale.
  assert.match(layout, /locale: preview\.locale/);
  assert.match(read("src/app/not-found.tsx"), /getBusinessTranslationServer/);
});
