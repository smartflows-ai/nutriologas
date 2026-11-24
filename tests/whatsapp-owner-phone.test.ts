// tests/whatsapp-owner-phone.test.ts
// Run: npx tsx --test tests/whatsapp-owner-phone.test.ts
// Evolution fills the owner number a moment after the connection opens: the read is repeated before giving up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readOwnerPhone } from "../src/lib/whatsapp-phone";

const noWait = async () => {};

test("returns the number on the first read without waiting", async () => {
  let waits = 0;
  const phone = await readOwnerPhone(async () => "5218446683688", { tries: 3, wait: async () => { waits += 1; } });
  assert.equal(phone, "5218446683688");
  assert.equal(waits, 0);
});

test("retries until the number appears", async () => {
  const answers = [null, null, "5218446683688"];
  let i = 0;
  const phone = await readOwnerPhone(async () => answers[i++] ?? null, { tries: 3, wait: noWait });
  assert.equal(phone, "5218446683688");
  assert.equal(i, 3);
});

test("gives null after the last try, with no wait after the last read", async () => {
  let reads = 0;
  let waits = 0;
  const phone = await readOwnerPhone(async () => { reads += 1; return null; }, { tries: 3, wait: async () => { waits += 1; } });
  assert.equal(phone, null);
  assert.equal(reads, 3);
  assert.equal(waits, 2);
});
