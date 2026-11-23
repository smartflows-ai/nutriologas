// tests/price-text-whole.test.ts
// Ticket #167: a whole amount reads "$2,300" (no ".00") in the text sent to machines (bot, Newy AI, campaigns); an amount
// with cents keeps two decimals. The screens keep formatPrice. Pure, no database.
// Run with: npx tsx --test tests/price-text-whole.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { formatPriceForMachines, priceFieldsFor, priceTextFor } from "../src/lib/price-text";
import { formatPrice } from "../src/lib/utils";

test("a whole amount has no decimals, in Spanish and English", () => {
  assert.equal(formatPriceForMachines(2300, "es-MX"), "$2,300");
  // Intl writes the peso as "MX$" in English; that is how formatPrice already reads and it does not change here.
  assert.equal(formatPriceForMachines(2300, "en-US"), "MX$2,300");
  assert.equal(formatPriceForMachines(500, "es-MX"), "$500");
  assert.equal(formatPriceForMachines(2000, "es-MX"), "$2,000");
  assert.equal(formatPriceForMachines(1200000, "es-MX"), "$1,200,000");
});

test("an amount with cents keeps two decimals", () => {
  assert.equal(formatPriceForMachines(2300.5, "es-MX"), "$2,300.50");
  assert.equal(formatPriceForMachines(99.99, "en-US", "USD"), "$99.99");
  assert.equal(formatPriceForMachines(99.99, "en-US"), "MX$99.99");
  assert.equal(formatPriceForMachines(0.05, "es-MX"), "$0.05");
});

test("a float that is whole once rounded to cents counts as whole", () => {
  assert.equal(formatPriceForMachines(2300.0000001, "es-MX"), "$2,300");
  assert.equal(formatPriceForMachines(0.1 + 0.2 + 2299.7, "es-MX"), "$2,300");
});

test("another currency follows the same rule", () => {
  assert.equal(formatPriceForMachines(50, "en-US", "USD"), "$50");
  assert.equal(formatPriceForMachines(50.25, "en-US", "USD"), "$50.25");
});

test("the bot text: fixed, from, on request and free, in both languages", () => {
  assert.equal(priceTextFor({ price: 2300, priceMode: "FIXED" }, "es"), "$2,300");
  assert.equal(priceTextFor({ price: 2300.5, priceMode: "FIXED" }, "es"), "$2,300.50");
  assert.match(priceTextFor({ price: 2000, priceMode: "FROM" }, "es"), /^Desde \$2,000\. /);
  assert.match(priceTextFor({ price: 2000, priceMode: "FROM" }, "en"), /^From MX\$2,000\. /);
  assert.doesNotMatch(priceTextFor({ price: 2000, priceMode: "FROM" }, "es"), /\.00/);
  assert.equal(priceTextFor({ price: 0, priceMode: "FIXED" }, "es"), "Gratis");
  assert.equal(priceTextFor({ price: 0, priceMode: "FIXED" }, "en"), "Free");
  const onRequest = priceTextFor({ price: 0, priceMode: "ON_REQUEST" }, "es");
  assert.doesNotMatch(onRequest, /\$|\d/, "on request names no number");
});

test("priceFieldsFor carries the whole-number text and keeps price null on request", () => {
  assert.deepEqual(priceFieldsFor({ price: 2300, priceMode: "FIXED" }, "es"), { price: 2300, priceMode: "FIXED", priceText: "$2,300" });
  assert.equal(priceFieldsFor({ price: 0, priceMode: "ON_REQUEST" }, "es").price, null);
});

test("the screens are not changed: formatPrice still shows two decimals", () => {
  assert.equal(formatPrice(2300, "es-MX"), "$2,300.00");
});
