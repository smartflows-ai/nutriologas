// Ticket #16, phase 2: the data written to an appointment after a reminder succeeds, fails, or the visit is rescheduled.
// Run: npx tsx --test local-utils/reminder-state.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ERROR_LENGTH,
  failedSendState,
  omitReminderError,
  rescheduleResetState,
  safeFailureReason,
  sentState,
} from "../src/lib/reminder-state";

const NOW = new Date("2026-11-02T18:00:00.000Z");

test("a successful send marks the reminder and clears every failure field", () => {
  assert.deepEqual(sentState(NOW), {
    reminderSentAt: NOW,
    reminderAttempts: 0,
    reminderLastError: null,
    reminderLastAttemptAt: null,
  });
});

test("a failed send counts one more attempt and keeps the reason and time", () => {
  assert.deepEqual(failedSendState(2, "WhatsApp no está conectado para este negocio", NOW), {
    reminderAttempts: 3,
    reminderLastError: "WhatsApp no está conectado para este negocio",
    reminderLastAttemptAt: NOW,
  });
});

test("a failed send never marks the reminder as sent", () => {
  assert.equal("reminderSentAt" in failedSendState(0, "x", NOW), false);
});

test("a stored reason never exceeds the maximum length", () => {
  const state = failedSendState(0, "WhatsApp no está conectado para este negocio".repeat(20), NOW);
  assert.ok((state.reminderLastError?.length ?? 0) <= MAX_ERROR_LENGTH);
});

test("an empty reason still leaves a readable text", () => {
  assert.equal(failedSendState(0, "   ", NOW).reminderLastError, "Envio rechazado");
});

test("rescheduling resets the reminder, the confirmation and the failure fields", () => {
  assert.deepEqual(rescheduleResetState(), {
    reminderSentAt: null,
    customerConfirmedAt: null,
    autoReleasedAt: null,
    reminderAttempts: 0,
    reminderLastError: null,
    reminderLastAttemptAt: null,
  });
});

test("each call returns a new object, so callers cannot share and mutate it", () => {
  assert.notEqual(rescheduleResetState(), rescheduleResetState());
});

test("the provider name and raw response body never reach the stored reason", () => {
  const raw = 'Error Evolution API (400): {"message":"number 5281xxxxxxx is not on WhatsApp","apikey":"abc"}';
  const safe = safeFailureReason(raw);
  assert.equal(safe, "Envio rechazado (HTTP 400)");
  assert.doesNotMatch(safe, /evolution|apikey|number|\{/i);
  assert.equal(failedSendState(0, raw, NOW).reminderLastError, "Envio rechazado (HTTP 400)");
});

test("known customer-safe reasons pass through unchanged", () => {
  for (const reason of ["WhatsApp no está conectado para este negocio", "Número de teléfono inválido"]) {
    assert.equal(safeFailureReason(reason), reason);
  }
});

test("an unknown technical error is replaced by a generic text", () => {
  assert.equal(safeFailureReason("connect ECONNREFUSED 10.0.0.5:8080"), "Envio rechazado");
  assert.equal(safeFailureReason("simulated failure (ticket #16 test)"), "Envio rechazado");
});

test("omitReminderError removes the stored reason and keeps every other field", () => {
  const row = { id: "a1", status: "PENDING", reminderAttempts: 2, reminderLastError: "x" };
  const result = omitReminderError(row);
  assert.equal("reminderLastError" in result, false);
  assert.deepEqual(result, { id: "a1", status: "PENDING", reminderAttempts: 2 });
  assert.equal(row.reminderLastError, "x", "the original row is not mutated");
});
