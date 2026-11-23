// tests/n8n-p0-nodes.test.ts
// Tickets #139 and #140: the code of two n8n nodes lives in n8n/docs/cambios-n8n-p0-bot-139-140-141.md (the workflow
// is not in git). These tests extract that code from the document and run it, so the text that gets pasted is the text
// that is tested, like tests/person-request.test.ts does for the person guard. Run with: npx tsx --test tests/n8n-p0-nodes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { messageContentOf } from "../src/lib/wa-message-content";

const DOC = readFileSync(path.join(__dirname, "..", "n8n/docs/cambios-n8n-p0-bot-139-140-141.md"), "utf8");

function block(name: string): string {
  const match = DOC.match(new RegExp(`<!-- ${name}:start -->\\s*\`\`\`js\\n([\\s\\S]*?)\`\`\`\\s*<!-- ${name}:end -->`));
  assert.ok(match, `the document has the ${name} block`);
  return match![1];
}

type Item = { json: Record<string, unknown> };
type Run = (json: Record<string, unknown>, nodes: Record<string, Item[] | "missing">) => Item[];

function compile(code: string): Run {
  const fn = new Function("$json", "$", code) as (json: unknown, $: (name: string) => unknown) => Item[];
  return (json, nodes) =>
    fn(json, (name: string) => ({
      first: () => (nodes[name] as Item[])[0],
      all: () => {
        if (nodes[name] === "missing" || nodes[name] === undefined) throw new Error("no run data");
        return nodes[name] as Item[];
      },
    }));
}

test("Strip File Data keeps only what whatsapp/sync reads and never the file", () => {
  const run = compile(block("strip-file-data"));
  const extract: Item = {
    json: {
      instance: "inst-1",
      customerPhone: "5218111813540",
      text: "",
      pushName: "Ana",
      eventData: {
        key: { id: "ABC", remoteJid: "5218111813540@s.whatsapp.net", remoteJidAlt: undefined, fromMe: false },
        pushName: "Ana",
        messageTimestamp: 1700000000,
        messageType: "videoMessage",
        message: { videoMessage: { url: "https://x", caption: "mi pie" }, base64: "A".repeat(6_000_000) },
        base64: "B".repeat(6_000_000),
      },
    },
  };
  const out = run({}, { "Extract Message": [extract] })[0].json as { instance: string; data: Record<string, unknown> };
  const body = JSON.stringify({ instance: out.instance, data: out.data });
  assert.ok(body.length < 1000, `the body is tiny (${body.length} bytes), whatever the size of the file`);
  assert.doesNotMatch(body, /base64|AAAA|BBBB|mi pie|https:\/\/x/);
  assert.equal(out.instance, "inst-1");
  assert.deepEqual((out.data as { key: unknown }).key, { id: "ABC", remoteJid: "5218111813540@s.whatsapp.net", remoteJidAlt: undefined, fromMe: false });
  assert.equal(messageContentOf((out.data as { message: never }).message), "[Video]");
});

test("Strip File Data gives the same stored line for each of the four file types", () => {
  const run = compile(block("strip-file-data"));
  const expected: Record<string, string> = {
    audioMessage: "[Audio]",
    imageMessage: "[Imagen]",
    videoMessage: "[Video]",
    documentMessage: "[Documento]",
    documentWithCaptionMessage: "[Documento]",
  };
  for (const [type, line] of Object.entries(expected)) {
    const extract: Item = { json: { instance: "i", eventData: { key: { id: "1", remoteJid: "5@s.whatsapp.net" }, messageType: type, message: { [type]: { base64: "AAAA", caption: "no se lee" } } } } };
    const out = run({}, { "Extract Message": [extract] })[0].json as { data: { message: never } };
    assert.equal(messageContentOf(out.data.message), line, type);
  }
});

test("Strip File Data finds the type from the message when the event has no messageType", () => {
  const run = compile(block("strip-file-data"));
  const extract: Item = { json: { instance: "i", eventData: { key: { id: "1", remoteJid: "5@s.whatsapp.net" }, message: { audioMessage: { base64: "AAAA" } } } } };
  const out = run({}, { "Extract Message": [extract] })[0].json as { data: { message: never } };
  assert.equal(messageContentOf(out.data.message), "[Audio]");
});

const guard = () => compile(block("guard-booking-claim"));
const ok: Item[] = [{ json: { success: true } }];
const failed: Item[] = [{ json: { success: false, error: "slot_unavailable" } }];

test("Booking Claim marks a reply that says the visit is booked when no tool succeeded", () => {
  const run = guard();
  for (const reply of ["Listo, tu cita quedó agendada para el lunes.", "Ya quedó confirmada tu cita.", "Hemos agendado tu cita.", "Agendé tu cita a las 5."]) {
    const out = run({ output: reply }, { book_appointment: failed })[0].json;
    assert.equal(out.claimUnbacked, true, reply);
    assert.equal(out.output, reply, "the reply is never changed");
  }
});

test("Booking Claim marks nothing when book_appointment, reschedule, list or confirm succeeded", () => {
  const run = guard();
  for (const tool of ["book_appointment", "reschedule_appointment", "list_my_appointments", "confirm_appointment"]) {
    assert.equal(run({ output: "Tu cita quedó agendada." }, { [tool]: ok })[0].json.claimUnbacked, false, tool);
  }
});

test("Booking Claim: a tool that did not run counts as not succeeded, and never throws", () => {
  const run = guard();
  assert.equal(run({ output: "Ya quedó agendada." }, {})[0].json.claimUnbacked, true);
  assert.equal(run({ output: "Ya quedó agendada." }, { book_appointment: "missing" })[0].json.claimUnbacked, true);
});

test("Booking Claim does not mark replies that do not claim a booking, or that deny it", () => {
  const run = guard();
  for (const reply of ["¿Te agendo el lunes a las 5?", "Hay horarios el lunes.", "La cita no quedó agendada, ese horario está ocupado.", "Todavía no está confirmada.", ""]) {
    assert.equal(run({ output: reply }, { book_appointment: failed })[0].json.claimUnbacked, false, reply);
  }
});

test("the document says N1 goes only after the deploy and that the guard starts in shadow mode", () => {
  assert.match(DOC, /N1 solo después de desplegar/);
  assert.match(DOC, /MODO SOMBRA|modo sombra/);
  assert.match(DOC, /unas 100 conversaciones/);
});

test("the document carries no secret and no provider name for the customer", () => {
  assert.doesNotMatch(DOC, /sk-[A-Za-z0-9]{10,}|Bearer\s+[A-Za-z0-9._-]{15,}|x-internal-key:\s*\S{8,}/);
});
