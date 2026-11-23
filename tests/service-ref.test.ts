// tests/service-ref.test.ts
// Ticket #140: the model sometimes retypes a service id wrong (run 22764: the first 13 characters right, the end
// changed) and the patient hears "no encuentro el servicio". The app resolves the service with tolerance and, when it
// cannot, answers with the list of services so the agent retries. Pure rules, no database.
// Run with: npx tsx --test tests/service-ref.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { MAX_RESCUE_OPTIONS, resolveServiceRef, serviceNotFoundBody } from "../src/lib/service-ref";

const A = { id: "9632fcca-3ba4-4d82-a5e1-8cb77f89486b", name: "Check Up Ginecológico" };
const B = { id: "cb4cdcc9-5c1e-4cb7-8a83-dd77ca6b20ae", name: "Consulta Ginecológica" };
const C = { id: "07f41fa4-441c-4c6f-959a-c821ff1992af", name: "Ginecología Estética" };
const SERVICES = [A, B, C];

test("an exact id resolves by id", () => {
  assert.deepEqual(resolveServiceRef(SERVICES, { productId: B.id }), { ok: true, service: B, via: "id" });
});

test("an id with the end changed (the case of run 22764) resolves by its first 8 characters", () => {
  const wrong = "9632fcca-3ba4-4d82-a5b3-dd360679ae03";
  assert.deepEqual(resolveServiceRef(SERVICES, { productId: wrong }), { ok: true, service: A, via: "prefix" });
});

test("the prefix is compared without caring about case", () => {
  assert.deepEqual(resolveServiceRef(SERVICES, { productId: "9632FCCA-3BA4-4D82-A5B3" }), { ok: true, service: A, via: "prefix" });
});

test("two services that share the first 8 characters are never guessed", () => {
  const twin = { id: "9632fcca-0000-4000-8000-000000000000", name: "Otro servicio" };
  const result = resolveServiceRef([A, twin, B], { productId: "9632fcca-3ba4-4d82-a5b3-dd360679ae03" });
  assert.equal(result.ok, false);
});

test("a prefix shorter than 8 characters is never guessed, even when it is unique", () => {
  assert.equal(resolveServiceRef(SERVICES, { productId: "9632fc" }).ok, false);
  assert.equal(resolveServiceRef(SERVICES, { productId: "9632fcc" }).ok, false);
});

test("something that does not look like an id is never matched by prefix", () => {
  assert.equal(resolveServiceRef(SERVICES, { productId: "Consulta Ginecológica" }).ok, true, "it is a name, resolved by name");
  assert.equal(resolveServiceRef(SERVICES, { productId: "zzzzzzzz-1234" }).ok, false);
});

test("the service name resolves it, ignoring case, accents and spaces around", () => {
  assert.deepEqual(resolveServiceRef(SERVICES, { serviceName: "  consulta ginecologica " }), { ok: true, service: B, via: "name" });
  assert.deepEqual(resolveServiceRef(SERVICES, { productId: "CHECK UP GINECOLOGICO" }), { ok: true, service: A, via: "name" });
});

test("a name that fits two services, or none, is not guessed", () => {
  const dup = [A, { id: "11111111-1111-4111-8111-111111111111", name: "check up ginecologico" }];
  assert.equal(resolveServiceRef(dup, { serviceName: "Check Up Ginecológico" }).ok, false);
  assert.equal(resolveServiceRef(SERVICES, { serviceName: "Masaje" }).ok, false);
});

test("nothing sent is not found", () => {
  assert.equal(resolveServiceRef(SERVICES, {}).ok, false);
  assert.equal(resolveServiceRef(SERVICES, { productId: "", serviceName: "" }).ok, false);
  assert.equal(resolveServiceRef(SERVICES, { productId: 5, serviceName: null }).ok, false);
  assert.equal(resolveServiceRef([], { productId: A.id }).ok, false);
});

test("the services of another business never enter the list: only what the caller passes is searched or offered", () => {
  const other = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", name: "Servicio ajeno" };
  const result = resolveServiceRef(SERVICES, { productId: other.id });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.options.some((option) => option.id === other.id), false);
});

test("when nothing fits, the list holds only what the caller can offer, with id and name only", () => {
  const result = resolveServiceRef(SERVICES, { productId: "nada" }, (service) => service.id !== C.id);
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.options, [A, B].map(({ id, name }) => ({ id, name })));
});

test("a long catalog never floods the agent: the rescue list is cut and the message says so", () => {
  const many = Array.from({ length: MAX_RESCUE_OPTIONS + 20 }, (_, index) => ({ id: `id-${index}`, name: `Servicio ${index}` }));
  const body = serviceNotFoundBody(many);
  assert.equal(MAX_RESCUE_OPTIONS, 30);
  assert.equal(body.services.length, MAX_RESCUE_OPTIONS);
  assert.equal(body.truncated, true);
  assert.match(body.message, /30/);
  assert.match(body.message, /nombre exacto/i);
});

test("a short list is complete and says nothing about being cut", () => {
  const body = serviceNotFoundBody([{ id: A.id, name: A.name }]);
  assert.equal(body.truncated, false);
  assert.doesNotMatch(body.message, /primeros/i);
});

test("the not found answer tells the agent to pick from the list and not to say the service does not exist", () => {
  const body = serviceNotFoundBody([{ id: A.id, name: A.name }]);
  assert.equal(body.success, false);
  assert.equal(body.error, "service_not_found");
  assert.deepEqual(body.services, [{ id: A.id, name: A.name }]);
  assert.match(body.message, /lista/i);
  assert.match(body.message, /no le digas/i);
  assert.doesNotMatch(body.message, /claude|anthropic|openai|gpt|openrouter|evolution|n8n|baileys/i);
  assert.doesNotMatch(body.message, /consultorio|paciente|cl[ií]nica|doctor/i);
});
