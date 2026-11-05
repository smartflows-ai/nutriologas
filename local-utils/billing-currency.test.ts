// Tests for src/lib/billing-currency.ts. Run: npx tsx --test local-utils/billing-currency.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isOfferedIn, priceEnvNames, resolveBillingCurrency } from "../src/lib/billing-currency";

test("an existing subscription decides the currency, whatever the phone says", () => {
  assert.equal(resolveBillingCurrency({ existingSubscriptionCurrency: "MXN", whatsappNumber: "+15551234567" }), "mxn");
  assert.equal(resolveBillingCurrency({ existingSubscriptionCurrency: "usd", whatsappNumber: "+525512345678" }), "usd");
});

test("without a subscription, a Mexican WhatsApp number means MXN", () => {
  assert.equal(resolveBillingCurrency({ whatsappNumber: "+525512345678" }), "mxn");
});

test("anything else is USD, including a missing number", () => {
  assert.equal(resolveBillingCurrency({ whatsappNumber: "+15551234567" }), "usd");
  assert.equal(resolveBillingCurrency({ whatsappNumber: null }), "usd");
  assert.equal(resolveBillingCurrency({}), "usd");
});

test("USD tries the _DLLS variable first, then the plain one", () => {
  assert.deepEqual(priceEnvNames("PLUS", "monthly", "usd"), ["STRIPE_PRICE_PLUS_MONTHLY_DLLS", "STRIPE_PRICE_PLUS_MONTHLY"]);
  assert.deepEqual(priceEnvNames("PRO", "annual", "usd"), ["STRIPE_PRICE_PRO_ANNUAL_DLLS", "STRIPE_PRICE_PRO_ANNUAL"]);
});

test("MXN uses only the plain variable (no _DLLS)", () => {
  assert.deepEqual(priceEnvNames("PLUS", "monthly", "mxn"), ["STRIPE_PRICE_PLUS_MONTHLY"]);
  assert.deepEqual(priceEnvNames("STARTER", "monthly", "mxn"), ["STRIPE_PRICE_STARTER_MONTHLY"]);
});

test("Plus is monthly only, and MXN is monthly only", () => {
  assert.equal(isOfferedIn("PLUS", "annual", "usd"), false);
  assert.equal(isOfferedIn("PRO", "annual", "mxn"), false);
  assert.equal(isOfferedIn("PLUS", "monthly", "mxn"), true);
  assert.equal(isOfferedIn("PRO", "annual", "usd"), true);
});
