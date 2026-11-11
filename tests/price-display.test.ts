// tests/price-display.test.ts
// A price that depends on the assessment: fixed, "from", or "on request". Pure rules, no database.
// Run with: npx tsx --test tests/price-display.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  isPurchasable,
  partitionPurchasable,
  priceModeOf,
  priceTextForBot,
  priceView,
  resolveAssessmentTarget,
  sortByPrice,
  type PriceCopy,
} from "../src/lib/price-display";

const copy: PriceCopy = {
  from: "From {amount}",
  onRequest: "Price after assessment",
  free: "Free",
  footnote: "The final price is confirmed after the assessment.",
};
const money = (n: number) => `$${n.toFixed(2)}`;

test("a product with no mode, or an unknown one, is fixed", () => {
  assert.equal(priceModeOf({ price: 10 }), "FIXED");
  assert.equal(priceModeOf({ price: 10, priceMode: null }), "FIXED");
  assert.equal(priceModeOf({ price: 10, priceMode: "WHATEVER" as never }), "FIXED");
});

test("fixed price shows the amount and no footnote", () => {
  const v = priceView({ price: 500, priceMode: "FIXED" }, copy, money);
  assert.deepEqual(v, { kind: "fixed", amount: 500, text: "$500.00", footnote: null });
});

test("a fixed price of zero is shown as free", () => {
  const v = priceView({ price: 0, priceMode: "FIXED" }, copy, money);
  assert.deepEqual(v, { kind: "free", amount: 0, text: "Free", footnote: null });
});

test("from price shows the starting amount and the footnote", () => {
  const v = priceView({ price: 500, priceMode: "FROM" }, copy, money);
  assert.deepEqual(v, { kind: "from", amount: 500, text: "From $500.00", footnote: copy.footnote });
});

test("on request never carries an amount, whatever is stored in price", () => {
  const v = priceView({ price: 0, priceMode: "ON_REQUEST" }, copy, money);
  assert.deepEqual(v, { kind: "onRequest", amount: null, text: "Price after assessment", footnote: copy.footnote });
  assert.equal(priceView({ price: 999, priceMode: "ON_REQUEST" }, copy, money).amount, null);
});

test("a from price with no starting amount degrades to on request instead of showing zero", () => {
  const v = priceView({ price: 0, priceMode: "FROM" }, copy, money);
  assert.equal(v.kind, "onRequest");
  assert.equal(v.amount, null);
});

test("only a fixed price above zero can be bought", () => {
  assert.equal(isPurchasable({ price: 10, priceMode: "FIXED" }), true);
  assert.equal(isPurchasable({ price: 10 }), true);
  assert.equal(isPurchasable({ price: 0, priceMode: "FIXED" }), false);
  assert.equal(isPurchasable({ price: 10, priceMode: "FROM" }), false);
  assert.equal(isPurchasable({ price: 0, priceMode: "ON_REQUEST" }), false);
});

test("partitionPurchasable separates what can be charged from what cannot", () => {
  const items = [
    { id: "a", price: 10, priceMode: "FIXED" as const },
    { id: "b", price: 20, priceMode: "FROM" as const },
    { id: "c", price: 0, priceMode: "ON_REQUEST" as const },
    { id: "d", price: 0, priceMode: "FIXED" as const },
  ];
  const { purchasable, refused } = partitionPurchasable(items);
  assert.deepEqual(purchasable.map((i) => i.id), ["a"]);
  assert.deepEqual(refused.map((i) => i.id), ["b", "c", "d"]);
});

test("the sentence for the bot carries the label and the footnote, and no number for on request", () => {
  assert.equal(priceTextForBot({ price: 500, priceMode: "FIXED" }, copy, money), "$500.00");
  assert.equal(
    priceTextForBot({ price: 500, priceMode: "FROM" }, copy, money),
    "From $500.00. The final price is confirmed after the assessment."
  );
  const none = priceTextForBot({ price: 0, priceMode: "ON_REQUEST" }, copy, money);
  assert.equal(none, "Price after assessment. The final price is confirmed after the assessment.");
  assert.equal(/\d/.test(none), false);
});

const tenantOn = { isBookingEnabled: true };
const target = {
  id: "t1", tenantId: "x", name: "General consultation", slug: "general-consultation",
  isActive: true, deletedAt: null, requiresBooking: true, price: 500, priceMode: "FIXED" as const,
};
const injury = { id: "p1", tenantId: "x", priceMode: "ON_REQUEST" as const, assessmentProductId: "t1" };

test("an on-request service redirects to its assessment service", () => {
  assert.deepEqual(resolveAssessmentTarget(injury, target, tenantOn), { id: "t1", name: "General consultation", slug: "general-consultation" });
});

test("a free assessment service is a valid target", () => {
  assert.notEqual(resolveAssessmentTarget(injury, { ...target, price: 0 }, tenantOn), null);
});

test("no redirect when the service is not on request or has no target", () => {
  assert.equal(resolveAssessmentTarget({ ...injury, priceMode: "FIXED" }, target, tenantOn), null);
  assert.equal(resolveAssessmentTarget({ ...injury, priceMode: "FROM" }, target, tenantOn), null);
  assert.equal(resolveAssessmentTarget({ ...injury, assessmentProductId: null }, target, tenantOn), null);
  assert.equal(resolveAssessmentTarget(injury, null, tenantOn), null);
});

test("a target that is gone, hidden, in another business, not bookable or not fixed never redirects", () => {
  assert.equal(resolveAssessmentTarget(injury, { ...target, deletedAt: new Date() }, tenantOn), null);
  assert.equal(resolveAssessmentTarget(injury, { ...target, isActive: false }, tenantOn), null);
  assert.equal(resolveAssessmentTarget(injury, { ...target, tenantId: "other" }, tenantOn), null);
  assert.equal(resolveAssessmentTarget(injury, { ...target, requiresBooking: false }, tenantOn), null);
  assert.equal(resolveAssessmentTarget(injury, target, { isBookingEnabled: false }), null);
  assert.equal(resolveAssessmentTarget(injury, { ...target, priceMode: "FROM" }, tenantOn), null);
  assert.equal(resolveAssessmentTarget(injury, { ...target, priceMode: "ON_REQUEST" }, tenantOn), null);
});

test("a service never redirects to itself, and the candidate must be the one pointed to", () => {
  assert.equal(resolveAssessmentTarget({ ...injury, assessmentProductId: "p1" }, { ...target, id: "p1" }, tenantOn), null);
  assert.equal(resolveAssessmentTarget(injury, { ...target, id: "someone-else" }, tenantOn), null);
});

test("sorting by price puts on-request items last in both directions", () => {
  const list = [
    { n: "ask", price: 0, priceMode: "ON_REQUEST" as const },
    { n: "cheap", price: 10, priceMode: "FIXED" as const },
    { n: "from", price: 50, priceMode: "FROM" as const },
    { n: "mid", price: 30, priceMode: "FIXED" as const },
  ];
  assert.deepEqual(sortByPrice(list, "asc").map((i) => i.n), ["cheap", "mid", "from", "ask"]);
  assert.deepEqual(sortByPrice(list, "desc").map((i) => i.n), ["from", "mid", "cheap", "ask"]);
  assert.equal(list[0].n, "ask", "the input list is not mutated");
});

import { normalizePriceInput } from "../src/lib/price-display";

test("on request is saved with a price of 0 and keeps the assessment pointer", () => {
  assert.deepEqual(
    normalizePriceInput({ priceMode: "ON_REQUEST", price: 800, assessmentProductId: "t1", itemType: "SERVICE" }, { partial: false }),
    { ok: true, value: { price: 0, priceMode: "ON_REQUEST", assessmentProductId: "t1", requiresBooking: false } }
  );
  assert.deepEqual(
    normalizePriceInput({ priceMode: "ON_REQUEST" }, { partial: false }),
    { ok: true, value: { price: 0, priceMode: "ON_REQUEST", assessmentProductId: null } }
  );
});

test("from needs an amount above zero and drops the pointer", () => {
  assert.deepEqual(
    normalizePriceInput({ priceMode: "FROM", price: 300, assessmentProductId: "t1" }, { partial: false }),
    { ok: true, value: { price: 300, priceMode: "FROM", assessmentProductId: null } }
  );
  assert.deepEqual(normalizePriceInput({ priceMode: "FROM", price: 0 }, { partial: false }), { ok: false, error: "startingPriceRequired" });
});

test("a fixed price must be positive, except a free service", () => {
  assert.deepEqual(
    normalizePriceInput({ priceMode: "FIXED", price: 500, itemType: "SERVICE" }, { partial: false }),
    { ok: true, value: { price: 500, priceMode: "FIXED", assessmentProductId: null } }
  );
  assert.deepEqual(normalizePriceInput({ price: 0, itemType: "SERVICE" }, { partial: false }), { ok: true, value: { price: 0, assessmentProductId: null } });
  assert.deepEqual(normalizePriceInput({ price: 0, itemType: "PHYSICAL" }, { partial: false }), { ok: false, error: "pricePositive" });
  assert.deepEqual(normalizePriceInput({ price: 0 }, { partial: false }), { ok: false, error: "pricePositive" });
  assert.deepEqual(normalizePriceInput({ price: -5, itemType: "SERVICE" }, { partial: false }), { ok: false, error: "pricePositive" });
});

test("a create with no price is refused, an update with no price fields is left alone", () => {
  assert.deepEqual(normalizePriceInput({ itemType: "SERVICE" }, { partial: false }), { ok: false, error: "priceRequired" });
  assert.deepEqual(normalizePriceInput({ priceMode: "FIXED", itemType: "SERVICE" }, { partial: false }), { ok: false, error: "priceRequired" });
  assert.deepEqual(normalizePriceInput({ itemType: "SERVICE" }, { partial: true }), { ok: true, value: {} });
});

import { storeAction } from "../src/lib/price-display";

const targetRef = { id: "t1", name: "General consultation", slug: "general-consultation" };

test("the button a product page offers", () => {
  assert.deepEqual(storeAction({ price: 500, priceMode: "FIXED" }, { bookable: true, target: null }), { kind: "book" });
  assert.deepEqual(storeAction({ price: 500, priceMode: "FROM" }, { bookable: true, target: null }), { kind: "book" });
  assert.deepEqual(storeAction({ price: 20, priceMode: "FIXED" }, { bookable: false, target: null }), { kind: "cart" });
  assert.deepEqual(storeAction({ price: 0, priceMode: "ON_REQUEST" }, { bookable: false, target: targetRef }), { kind: "bookTarget", target: targetRef });
});

test("a price that is not final is never added to the cart: the customer asks", () => {
  assert.deepEqual(storeAction({ price: 0, priceMode: "ON_REQUEST" }, { bookable: false, target: null }), { kind: "ask" });
  assert.deepEqual(storeAction({ price: 300, priceMode: "FROM" }, { bookable: false, target: null }), { kind: "ask" });
});

test("a free item that is not booked has nothing to press", () => {
  assert.deepEqual(storeAction({ price: 0, priceMode: "FIXED" }, { bookable: false, target: null }), { kind: "none" });
});

test("a target is ignored unless the price is on request", () => {
  assert.deepEqual(storeAction({ price: 500, priceMode: "FIXED" }, { bookable: true, target: targetRef }), { kind: "book" });
});

import { whatsappAskUrl } from "../src/lib/price-display";

test("the ask-on-WhatsApp link keeps only the digits and encodes the message", () => {
  assert.equal(whatsappAskUrl("+52 1 55 1234 5678", "Hello, price of Injury?"), "https://wa.me/5215512345678?text=Hello%2C%20price%20of%20Injury%3F");
  assert.equal(whatsappAskUrl(null, "x"), null);
  assert.equal(whatsappAskUrl("", "x"), null);
});

import { priceFieldsFor, priceTextFor } from "../src/lib/price-text";

test("price fields for the bot: no number when on request, the sentence in the business language", () => {
  const ask = priceFieldsFor({ price: 0, priceMode: "ON_REQUEST" }, "es");
  assert.equal(ask.price, null);
  assert.equal(ask.priceMode, "ON_REQUEST");
  assert.equal(/\d/.test(ask.priceText), false);
  assert.match(ask.priceText, /valoración/);
  const from = priceFieldsFor({ price: 500, priceMode: "FROM" }, "en");
  assert.equal(from.price, 500);
  assert.match(from.priceText, /^From /);
  assert.match(from.priceText, /assessment/);
  assert.equal(priceTextFor({ price: 500 }, "es").includes("500"), true);
});

import { productSchema, productBaseSchema } from "../src/lib/validations";

const baseProduct = { name: "Injury", itemType: "SERVICE" as const, stock: 0, images: [], isActive: true, requiresBooking: false };

test("the product form accepts on request with no price, and a free service", () => {
  assert.equal(productSchema.safeParse({ ...baseProduct, priceMode: "ON_REQUEST" }).success, true);
  assert.equal(productSchema.safeParse({ ...baseProduct, price: 0 }).success, true);
});

test("the product form refuses a starting price of zero and a free physical item, with a translatable key", () => {
  const from = productSchema.safeParse({ ...baseProduct, priceMode: "FROM", price: 0 });
  assert.equal(from.success, false);
  if (!from.success) assert.equal(from.error.issues[0].message, "startingPriceRequired");
  const physical = productSchema.safeParse({ ...baseProduct, itemType: "PHYSICAL", price: 0 });
  assert.equal(physical.success, false);
  if (!physical.success) assert.equal(physical.error.issues[0].message, "pricePositive");
});

test("an update schema can leave every price field out", () => {
  assert.equal(productBaseSchema.partial().safeParse({ isActive: false }).success, true);
});
