// tests/meeting-link-text.test.ts
// The video call link of an online visit goes into the WhatsApp reminder and confirmation messages, so a patient
// who gave no email (and got no calendar invitation) still receives it.
// Run with: npx tsx --test tests/meeting-link-text.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { withMeetingLink } from "../src/lib/reminder-messages";
import { runReminderBatch, type ReminderDeps, type ReminderVisit } from "../src/lib/reminder-run";

const URL = "https://meet.google.com/abc-defg-hij";

test("an online visit with a link gets the link under the message, in the business language", () => {
  assert.equal(withMeetingLink("Recordatorio", { modality: "ONLINE", meetUrl: URL }, "es"), `Recordatorio\n\nVideollamada: ${URL}`);
  assert.equal(withMeetingLink("Reminder", { modality: "ONLINE", meetUrl: URL }, "en"), `Reminder\n\nVideo call: ${URL}`);
});

test("in person visits, older visits and visits without a link keep the message as it is", () => {
  assert.equal(withMeetingLink("Hola", { modality: "IN_PERSON", meetUrl: URL }, "es"), "Hola");
  assert.equal(withMeetingLink("Hola", { modality: null, meetUrl: URL }, "es"), "Hola");
  assert.equal(withMeetingLink("Hola", { modality: "ONLINE", meetUrl: null }, "es"), "Hola");
  assert.equal(withMeetingLink("Hola", {}, "es"), "Hola");
});

test("only secure web links are added", () => {
  assert.equal(withMeetingLink("Hola", { modality: "ONLINE", meetUrl: "javascript:alert(1)" }, "es"), "Hola");
  assert.equal(withMeetingLink("Hola", { modality: "ONLINE", meetUrl: "http://example.com/x" }, "es"), "Hola");
});

test("the reminder job sends the link of an online visit", async () => {
  const NOW = new Date("2026-11-02T18:00:00.000Z");
  const HOUR = 60 * 60 * 1000;
  const online: ReminderVisit = {
    id: "a1",
    tenantId: "t1",
    customerPhone: "525500000001",
    customerName: null,
    appointmentDate: new Date(NOW.getTime() + 23 * HOUR),
    createdAt: new Date(NOW.getTime() - 48 * HOUR),
    reminderSentAt: null,
    reminderAttempts: 0,
    customerConfirmedAt: null,
    autoReleasedAt: null,
    externalProvider: null,
    externalEventId: null,
    productName: "Consulta",
    modality: "ONLINE",
    meetUrl: URL,
    tenant: {
      name: "Clinica",
      messageLanguage: "es",
      reminderLeadMinutes: 24 * 60,
      confirmationRequired: true,
      confirmationDeadlineMinutes: 120,
      reminderTemplate: null,
      confirmationTemplate: null,
      cancellationTemplate: null,
    },
  };
  const texts: string[] = [];
  const deps: ReminderDeps = {
    send: async (_v, text) => {
      texts.push(text);
      return { success: true };
    },
    markSent: async () => {},
    recordFailure: async () => {},
    charge: async () => {},
    release: async () => ({ customerNotified: true }),
  };
  await runReminderBatch([online], NOW, deps, { dryRun: false });
  assert.equal(texts.length, 1);
  assert.ok(texts[0].endsWith(`Videollamada: ${URL}`), "the link closes the reminder");
});
