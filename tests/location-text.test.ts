import { test } from "node:test";
import assert from "node:assert/strict";
import { locationTextForBot } from "../src/lib/location";
import { createRequire } from "node:module";
import nextConfig from "../next.config.mjs";

const require = createRequire(import.meta.url);
const { pathToRegexp } = require("next/dist/compiled/path-to-regexp") as { pathToRegexp: (s: string, k: unknown[], o: object) => RegExp };

const PLACE = {
  slug: "consultorio",
  customDomain: null,
  hasPhysicalLocation: true,
  address: "Av. Siempre Viva 742, Monterrey",
  placeId: null,
  latitude: null,
  longitude: null,
};

test("the directions link is never inside parentheses: WhatsApp would take the ')' into the link (B14)", () => {
  const text = locationTextForBot(PLACE);
  assert.equal(text, "Av. Siempre Viva 742, Monterrey. Cómo llegar: https://consultorio.newaigent.com/ubicacion");
  assert.ok(!text.includes("("));
  assert.ok(text.endsWith("/ubicacion"), "the link closes the text, nothing glued to it");
});

test("the label follows the business language", () => {
  assert.equal(
    locationTextForBot({ ...PLACE, messageLanguage: "en" }),
    "Av. Siempre Viva 742, Monterrey. Directions: https://consultorio.newaigent.com/ubicacion"
  );
  assert.ok(locationTextForBot({ ...PLACE, messageLanguage: "es" }).includes("Cómo llegar:"));
});

test("an address that already ends with a period does not get a second one", () => {
  assert.equal(
    locationTextForBot({ ...PLACE, address: "Calle 5 No. 10, Col. Centro." }),
    "Calle 5 No. 10, Col. Centro. Cómo llegar: https://consultorio.newaigent.com/ubicacion"
  );
});

test("no physical place or no address gives an empty text", () => {
  assert.equal(locationTextForBot({ ...PLACE, hasPhysicalLocation: false }), "");
  assert.equal(locationTextForBot({ ...PLACE, address: null }), "");
});

test("/ubicacion with punctuation glued to it goes to /ubicacion (same matcher as Next)", async () => {
  const rules = await (nextConfig as { redirects: () => Promise<{ source: string; destination: string; permanent: boolean }[]> }).redirects();
  const rule = rules.find((r) => r.destination === "/ubicacion");
  assert.ok(rule, "redirect rule present");
  assert.equal(rule.permanent, false);
  const matches = pathToRegexp(rule.source, [], { strict: true, sensitive: false, delimiter: "/" });
  for (const path of ["/ubicacion)", "/ubicacion.", "/ubicacion,", "/ubicacion;", "/ubicacion).", "/ubicacion%29"]) {
    assert.ok(matches.test(path), path);
  }
  // The plain address is served by the route itself; other paths are not touched.
  for (const path of ["/ubicacion", "/ubicacionx", "/ubicacion/x", "/online/abc)"]) {
    assert.equal(matches.test(path), false, path);
  }
});
