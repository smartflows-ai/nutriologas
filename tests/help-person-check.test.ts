// tests/help-person-check.test.ts
// Ticket #129: the agent called request_human_help with person_requested while the customer was booking for their
// daughter; the bot paused and the owner got a false notice. bot/help now accepts person_requested only when a
// customer message of the current turn asks for a person (the same rule as the n8n guard "Guard: Person Request").
// Run with: npx tsx --test tests/help-person-check.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { customerAskedForPerson, personRequestAllowed, type ChatLine } from "../src/lib/help-person-check";

const customer = (content: string): ChatLine => ({ fromMe: false, content });
const bot = (content: string): ChatLine => ({ fromMe: true, content });

test("booking for someone else, even with the sender's own number, is not a request for a person", () => {
  const lines = [
    customer("Se llama Sofía López, tiene 8 años, su número es 8124062968"),
    bot("¿Me compartes su nombre, edad y número?"),
    customer("Quiero agendar una cita para mi hija"),
  ];
  assert.equal(customerAskedForPerson(lines), false);
  assert.equal(personRequestAllowed("person_requested", lines), false);
});

test("production cases the fixed words do not match are handed off (angry customer, a named person)", () => {
  const angry = [customer("Estoy molesta porque no me estás generando una cita")];
  const named = [customer("Hola me puedes comunicar con Laura")];
  const payment = [customer("necesito que alguien me ayude con mi pago")];
  for (const lines of [angry, named, payment]) {
    assert.equal(personRequestAllowed("person_requested", lines), true);
  }
});

test("booking for someone else plus an explicit request, a named person or anger is handed off", () => {
  const cases = [
    "Quiero agendar para mi hija, mejor pásame con un asesor",
    "Es para mi hija, me puedes comunicar con Laura",
    "Es para mi hija y estoy muy molesta, es un mal servicio",
  ];
  for (const text of cases) {
    assert.equal(personRequestAllowed("person_requested", [customer(text)]), true, text);
  }
});

test("an explicit request in the current turn is accepted", () => {
  assert.equal(personRequestAllowed("person_requested", [customer("Quiero hablar con una persona"), bot("Hola")]), true);
});

test("every customer message since the bot's last reply counts (the flow batches them)", () => {
  const lines = [customer("gracias"), customer("mejor pásame con un asesor"), bot("Tengo 3 horarios")];
  assert.equal(personRequestAllowed("person_requested", lines), true);
});

test("a request from an earlier turn, already answered, does not count again", () => {
  const lines = [customer("Es para mi mamá"), bot("Claro, te ayudo"), customer("quiero hablar con alguien")];
  assert.equal(personRequestAllowed("person_requested", lines), false);
});

test("with no customer message to read, the request is accepted (never block a real one)", () => {
  assert.equal(customerAskedForPerson([]), null);
  assert.equal(customerAskedForPerson([bot("Hola")]), null);
  assert.equal(personRequestAllowed("person_requested", []), true);
});

test("other reasons are never checked against the messages", () => {
  const lines = [customer("Es para mi hija")];
  for (const reason of ["purchase_intent", "send_failed", "agent_failed", "credits_exhausted"] as const) {
    assert.equal(personRequestAllowed(reason, lines), true, reason);
  }
});
