// White-label: the reason of a failed WhatsApp send reaches the browser (toast on "Confirmar" in /admin/citas),
// so it must never name a provider or leak its response body.
// Run: npx tsx --test tests/whatsapp-reasons.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CUSTOMER_SAFE_REASONS, WA_NOT_AVAILABLE } from "../src/lib/whatsapp-reasons";
import { safeFailureReason } from "../src/lib/reminder-state";
import { es } from "../src/i18n/es";

const PROVIDERS = /evolution|n8n|openrouter|claude|gpt|conekta|anthropic/i;

test("no safe reason names a provider", () => {
  for (const r of CUSTOMER_SAFE_REASONS) assert.ok(!PROVIDERS.test(r), r);
});

test("the old provider texts are rewritten before they reach the browser", () => {
  const notConfigured = safeFailureReason("Evolution API no está configurado en las variables de entorno");
  assert.ok(!PROVIDERS.test(notConfigured), notConfigured);
  const rejected = safeFailureReason('Error Evolution API (500): {"message":"internal"}');
  assert.ok(!PROVIDERS.test(rejected) && !rejected.includes("internal"), rejected);
  assert.equal(safeFailureReason(WA_NOT_AVAILABLE), WA_NOT_AVAILABLE);
});

test("whatsapp.ts returns only reasons that are safe as written", () => {
  const src = readFileSync("src/lib/whatsapp.ts", "utf8");
  const reasons: string[] = [];
  const re = /reason:\s*([^}]+?)\s*\}/g;
  for (let m = re.exec(src); m; m = re.exec(src)) reasons.push(m[1]);
  assert.ok(reasons.length >= 4, "expected the send helper to return its reasons");
  for (const r of reasons) {
    if (/error\.message/.test(r)) continue; // unexpected errors are sanitized by the callers
    assert.ok(!PROVIDERS.test(r), `provider name in a returned reason: ${r}`);
  }
});

test("the confirm route sanitizes the reason before sending it to the browser", () => {
  const src = readFileSync("src/app/api/appointments/[id]/route.ts", "utf8");
  assert.match(src, /safeFailureReason\(waRes\.reason\)/);
});

test("the sidebar entries are in Spanish", () => {
  assert.equal(es.admin.dashboard, "Panel");
  assert.equal(es.admin.reviews, "Reseñas");
});
