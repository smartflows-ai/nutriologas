import { test } from "node:test";
import assert from "node:assert/strict";
import { placeParts } from "../src/lib/address-components";

const c = (longText: string, shortText: string, ...types: string[]) => ({ longText, shortText, types });

test("Saltillo: city, state and country", () => {
  assert.deepEqual(
    placeParts([
      c("Saltillo", "Saltillo", "locality", "political"),
      c("Coahuila de Zaragoza", "Coah.", "administrative_area_level_1", "political"),
      c("México", "MX", "country", "political"),
    ]),
    { city: "Saltillo", region: "Coahuila de Zaragoza", countryCode: "MX" }
  );
});

test("Cancún and Bogotá", () => {
  assert.deepEqual(
    placeParts([c("Cancún", "Cancún", "locality"), c("Quintana Roo", "Q.R.", "administrative_area_level_1"), c("México", "MX", "country")]),
    { city: "Cancún", region: "Quintana Roo", countryCode: "MX" }
  );
  assert.deepEqual(
    placeParts([c("Bogotá", "Bogotá", "locality"), c("Bogotá, D.C.", "Bogotá, D.C.", "administrative_area_level_1"), c("Colombia", "CO", "country")]),
    { city: "Bogotá", region: "Bogotá, D.C.", countryCode: "CO" }
  );
});

test("without a locality the municipality, then the sublocality, is the city", () => {
  assert.equal(
    placeParts([c("San Pedro Garza García", "San Pedro", "administrative_area_level_2"), c("México", "MX", "country")]).city,
    "San Pedro Garza García"
  );
  assert.equal(placeParts([c("Centro", "Centro", "sublocality", "political"), c("México", "MX", "country")]).city, "Centro");
});

test("missing pieces are null; bad input gives all null", () => {
  assert.deepEqual(placeParts([c("Saltillo", "Saltillo", "locality")]), { city: "Saltillo", region: null, countryCode: null });
  const none = { city: null, region: null, countryCode: null };
  assert.deepEqual(placeParts([]), none);
  assert.deepEqual(placeParts(undefined), none);
  assert.deepEqual(placeParts("x"), none);
  assert.deepEqual(placeParts([{ types: "locality" }, null, 3]), none);
  // A country code that is not two letters is not trusted.
  assert.equal(placeParts([c("Mexico", "Mexico", "country")]).countryCode, null);
});
