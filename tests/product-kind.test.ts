// What the agent is told about a catalog item: CITA (bookable), INFORMACION (described only) or PRODUCTO (physical).
import test from "node:test";
import assert from "node:assert/strict";
import { productKindOf } from "../src/lib/product-kind";

test("a physical item is PRODUCTO even when it is not bookable", () => {
  assert.equal(productKindOf({ itemType: "PHYSICAL", bookable: false }), "PRODUCTO");
});

test("a bookable service is CITA", () => {
  assert.equal(productKindOf({ itemType: "SERVICE", bookable: true }), "CITA");
});

test("a service without booking is INFORMACION", () => {
  assert.equal(productKindOf({ itemType: "SERVICE", bookable: false }), "INFORMACION");
  assert.equal(productKindOf({ itemType: "PACKAGE", bookable: false }), "INFORMACION");
});
