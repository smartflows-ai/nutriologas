// tests/google-event-description.test.ts
// The description of the Google Calendar event created by the internal route is plain text:
// Google shows it as is, so HTML tags would appear on the calendar and in the agenda.
// Run with: npx tsx --test tests/google-event-description.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { prepareEventData } from "../src/lib/google-calendar";

const base = {
  date: "2026-11-25",
  time: "11:00",
  duration: 30,
  attendeeName: "Paciente Prueba",
  attendeeEmail: "paciente@example.com",
  attendeePhone: "5218124062968",
  meetingTopic: "Demo de verificacion",
  tenantName: "Newy",
  zone: "America/Monterrey",
};

test("the event description has no HTML tags", () => {
  const { description } = prepareEventData(base);
  assert.doesNotMatch(description, /<\/?[a-z][^>]*>/i);
});

test("the description keeps the business, topic, client, email and phone on their own lines", () => {
  const { description } = prepareEventData(base);
  const lines = description.split("\n");
  assert.equal(lines[0], "Sesión de Consulta - Newy");
  assert.equal(lines[1], "Tema: Demo de verificacion");
  assert.equal(lines[2], "Cliente: Paciente Prueba");
  assert.equal(lines[3], "Email: paciente@example.com");
  assert.equal(lines[4], "Teléfono: 5218124062968");
});

test("a missing phone and topic fall back to the same defaults as before", () => {
  const { description, summary } = prepareEventData({
    ...base,
    attendeePhone: undefined,
    meetingTopic: undefined,
  });
  assert.match(description, /Tema: Consulta/);
  assert.match(description, /Teléfono: No registrado/);
  assert.equal(summary, "Consulta Newy: Consulta - Paciente Prueba");
});
