import { test } from "node:test";
import assert from "node:assert/strict";
import { TIME_ZONE_OPTIONS, countryForTimeZone } from "../src/lib/time-zones";
import { DEFAULT_DIAL_CODE, defaultDialCodeForZone, dialCodeForCountry } from "../src/lib/phone";
import { currencyForCountry, currencyForTimeZone } from "../src/lib/currency";

test("every zone the owner can pick has a country", () => {
  for (const option of TIME_ZONE_OPTIONS) {
    assert.match(countryForTimeZone(option.value) ?? "", /^[A-Z]{2}$/, option.value);
  }
});

test("every IANA zone of Mexico is Mexico", () => {
  for (const zone of [
    "America/Mexico_City", "America/Monterrey", "America/Merida", "America/Matamoros", "America/Chihuahua",
    "America/Ciudad_Juarez", "America/Ojinaga", "America/Bahia_Banderas", "America/Mazatlan", "America/Hermosillo",
    "America/Tijuana", "America/Cancun",
  ]) {
    assert.equal(countryForTimeZone(zone), "MX", zone);
  }
});

test("other countries and unknown zones", () => {
  assert.equal(countryForTimeZone("America/Bogota"), "CO");
  assert.equal(countryForTimeZone("Europe/Madrid"), "ES");
  assert.equal(countryForTimeZone("America/New_York"), "US");
  assert.equal(countryForTimeZone("America/Argentina/Buenos_Aires"), "AR");
  assert.equal(countryForTimeZone("Asia/Tokyo"), null);
  assert.equal(countryForTimeZone(""), null);
  assert.equal(countryForTimeZone(null), null);
});

test("the dial code follows the country of the business zone; unknown stays +52", () => {
  assert.equal(dialCodeForCountry("MX"), "52");
  assert.equal(dialCodeForCountry("CO"), "57");
  assert.equal(dialCodeForCountry("ZZ"), null);
  assert.equal(defaultDialCodeForZone("America/Monterrey"), "52");
  assert.equal(defaultDialCodeForZone("America/Bogota"), "57");
  assert.equal(defaultDialCodeForZone("America/Los_Angeles"), "1");
  assert.equal(defaultDialCodeForZone("Europe/Madrid"), "34");
  assert.equal(defaultDialCodeForZone("Asia/Tokyo"), DEFAULT_DIAL_CODE);
  assert.equal(defaultDialCodeForZone(undefined), DEFAULT_DIAL_CODE);
});

test("the bot currency follows the country; unknown stays MXN", () => {
  const expected: Record<string, string> = { MX: "MXN", US: "USD", CO: "COP", PE: "PEN", CL: "CLP", AR: "ARS", ES: "EUR" };
  for (const [iso, currency] of Object.entries(expected)) assert.equal(currencyForCountry(iso), currency, iso);
  assert.equal(currencyForCountry("BR"), "MXN");
  assert.equal(currencyForCountry(null), "MXN");
  assert.equal(currencyForTimeZone("America/Mexico_City"), "MXN");
  assert.equal(currencyForTimeZone("America/Lima"), "PEN");
  assert.equal(currencyForTimeZone("Asia/Tokyo"), "MXN");
});
