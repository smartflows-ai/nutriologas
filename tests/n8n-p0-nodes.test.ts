// tests/n8n-p0-nodes.test.ts
// Tickets #139 and #140: the code of two n8n nodes lives in n8n/docs/cambios-n8n-p0-bot-139-140-141.md (the workflow
// is not in git). These tests extract that code from the document and run it, so the text that gets pasted is the text
// that is tested, like tests/person-request.test.ts does for the person guard. Run with: npx tsx --test tests/n8n-p0-nodes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { messageContentOf } from "../src/lib/wa-message-content";
import { classifyInbound } from "../src/lib/unsupported-media";

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
  assert.equal(run({ output: "Ya quedó agendada tu cita." }, {})[0].json.claimUnbacked, true);
  assert.equal(run({ output: "Ya quedó agendada tu cita." }, { book_appointment: "missing" })[0].json.claimUnbacked, true);
});

test("Booking Claim does not mark replies that do not claim a booking, or that deny it", () => {
  const run = guard();
  for (const reply of ["¿Te agendo el lunes a las 5?", "Hay horarios el lunes.", "La cita no quedó agendada, ese horario está ocupado.", "Todavía no está confirmada.", ""]) {
    assert.equal(run({ output: reply }, { book_appointment: failed })[0].json.claimUnbacked, false, reply);
  }
});

test("Booking Claim marks how the bot really writes it (ha sido agendada) and other common forms in Spanish", () => {
  const run = guard();
  const replies = [
    "Tu cita con Dra. Ana ha sido agendada para el lunes a las 5.",
    "Tus citas han sido confirmadas.",
    "Tu cita ha sido reagendada para el martes.",
    "Tu cita quedó reservada para el lunes.",
    "Ya está programada tu cita del viernes.",
    "Te agendé para el lunes a las 5.",
    "Te reservé el horario de las 10.",
    "Hemos programado tu cita.",
  ];
  for (const reply of replies) {
    const out = run({ output: reply }, { book_appointment: failed })[0].json;
    assert.equal(out.claimUnbacked, true, reply);
    assert.equal(out.output, reply, "the reply is never changed");
  }
});

test("Booking Claim marks the same claims written in English", () => {
  const run = guard();
  const replies = [
    "Your appointment has been booked for Monday at 5 pm.",
    "Your visits have been confirmed.",
    "Your appointment has been rescheduled to Tuesday.",
    "Your appointment is booked for Monday.",
    "Your appointments are confirmed.",
    "I've booked you for Monday at 5.",
    "I have scheduled your visit.",
    "Your appointment is set for Friday at 10.",
    "Your appointment is confirmed!",
  ];
  for (const reply of replies) assert.equal(run({ output: reply }, { book_appointment: failed })[0].json.claimUnbacked, true, reply);
});

test("Booking Claim does not mark denials, questions or offers, in Spanish and English", () => {
  const run = guard();
  const replies = [
    "Tu cita no ha sido agendada, ese horario está ocupado.",
    "Todavía no ha sido confirmada.",
    "La cita aún no está programada.",
    "No pude agendar tu cita.",
    "Tengo el lunes a las 5, ¿te lo reservo?",
    "¿Quieres que te agende el lunes?",
    "Your appointment has not been booked.",
    "Your appointment has not been booked yet.",
    "It has not been booked, that time is taken.",
    "Your appointment isn't confirmed yet.",
    "That time is not booked.",
    "I couldn't book that time.",
    "I could not book your appointment.",
    "I haven't booked anything yet.",
    "Would you like me to book you on Monday at 5?",
    "I have Monday at 5 or Tuesday at 10 available.",
    "Once confirmed you will get a reminder.",
  ];
  for (const reply of replies) assert.equal(run({ output: reply }, { book_appointment: failed })[0].json.claimUnbacked, false, reply);
});

test("Booking Claim does not mark a reply that says a TIME is taken (the slot is the subject, not the customer's visit)", () => {
  const run = guard();
  const replies = [
    "Ese horario ya está reservado, ¿te ofrezco las 5:00?",
    "Esa hora ya está agendada por otra persona. ¿Te sirve las 6?",
    "El espacio de las 5 ya fue reservado, tengo las 6.",
    "That time is booked, how about 5 pm?",
    "That slot is already booked. Would 6 pm work?",
  ];
  for (const reply of replies) assert.equal(run({ output: reply }, { book_appointment: failed })[0].json.claimUnbacked, false, reply);
});

test("Booking Claim marks a status claim about the customer's visit, for any kind of business, even after a taken time", () => {
  const run = guard();
  const replies = [
    "Tu cita ha sido agendada.",
    "Your appointment has been booked.",
    "Tu reservación quedó confirmada.",
    "Your booking is confirmed!",
    "Ya quedó confirmada tu cita.",
    "Ese horario estaba ocupado. Tu cita ha sido agendada para las 6.",
  ];
  for (const reply of replies) assert.equal(run({ output: reply }, { book_appointment: failed })[0].json.claimUnbacked, true, reply);
});

test("Booking Claim: a denial does not hide a claim that comes later in the same reply", () => {
  const run = guard();
  assert.equal(run({ output: "No pude agendar el lunes. Pero tu cita ha sido agendada para el martes." }, {})[0].json.claimUnbacked, true);
});

test("Booking Claim: list_my_appointments backs the claim with a non-empty list even without success; an empty list does not", () => {
  const run = guard();
  const reply = "Tu cita ha sido agendada para el lunes.";
  const withVisits: Item[] = [{ json: { appointments: [{ id: "a1" }] } }];
  const empty: Item[] = [{ json: { appointments: [] } }];
  assert.equal(run({ output: reply }, { list_my_appointments: withVisits })[0].json.claimUnbacked, false);
  assert.equal(run({ output: reply }, { list_my_appointments: empty })[0].json.claimUnbacked, true);
  assert.equal(run({ output: reply }, { list_my_appointments: [{ json: { appointments: "x" } }] })[0].json.claimUnbacked, true);
  assert.equal(run({ output: reply }, { book_appointment: [{ json: { appointments: [{ id: "a1" }] } }] })[0].json.claimUnbacked, true, "only the list tool is read this way");
});

// The ```text blocks of section N1, in document order: the n8n proposal is generated from them, so their order is fixed.
function n1TextBlocks(): string[] {
  const start = DOC.indexOf("## N1.");
  const end = DOC.indexOf("## N2.");
  assert.ok(start > 0 && end > start, "the document has the N1 and N2 sections");
  return Array.from(DOC.slice(start, end).matchAll(/```text\n([\s\S]*?)```/g)).map((match) => match[1].trim());
}

test("the ```text blocks of N1 keep their order: file copy body, Media Decision, Send Media Reply, Write Media Reply", () => {
  const blocks = n1TextBlocks();
  assert.ok(blocks.length >= 5, `N1 has at least 5 text blocks (${blocks.length})`);
  assert.match(blocks[0], /data: \$json\.data/, "1st: body of Write Customer Message (File)");
  assert.match(blocks[1], /messageType:/, "2nd: body of Media Decision");
  assert.match(blocks[2], /text: \$\('Media Decision'\)\.first\(\)\.json\.reply/, "3rd: body of Send Media Reply");
  assert.match(blocks[3], /message: \{ conversation: \$\('Media Decision'\)/, "4th: body of Write Media Reply");
});

test("Send Media Reply carries the same message key as Write Media Reply, from the incoming message id", () => {
  const [, , send, write] = n1TextBlocks();
  const key = "'bot-media-' + ($('Extract Message').first().json.eventData?.key?.id || $execution.id)";
  assert.ok(send.includes(`messageKey: ${key}`), "Send Media Reply has the messageKey");
  assert.ok(write.includes(`id: ${key}`), "Write Media Reply uses the same key as its id");
});

const guardExpression = (): string => {
  const block = n1TextBlocks()[4];
  assert.match(block, /^=\{\{[\s\S]*\}\}$/, "the 5th text block is exactly the expression pasted in Guard: Is File Message");
  return block.replace(/^=\{\{/, "").replace(/\}\}$/, "");
};

function isFile(type: unknown, phone: unknown = "5218111813540"): boolean {
  const run = new Function("$", `return (${guardExpression()});`) as (stub: (name: string) => unknown) => unknown;
  return run(() => ({ first: () => ({ json: { customerPhone: phone, eventData: { messageType: type } } }) })) === true;
}

test("Guard: Is File Message lets through only the five file types, the same list the app uses", () => {
  for (const type of ["audioMessage", "imageMessage", "videoMessage", "documentMessage", "documentWithCaptionMessage"]) {
    assert.equal(isFile(type), true, type);
    assert.equal(classifyInbound(type), "file", `${type} is a file for the app too`);
  }
});

test("Guard: Is File Message keeps stickers, reactions, location, contacts and the rest as they are today", () => {
  for (const type of ["stickerMessage", "reactionMessage", "protocolMessage", "locationMessage", "liveLocationMessage", "contactMessage", "contactsArrayMessage", "pollCreationMessage", "somethingNewMessage", "", undefined, null, 5]) {
    assert.equal(isFile(type), false, String(type));
    assert.equal(classifyInbound(type), "silent", `${String(type)} is silent for the app too`);
  }
});

test("Guard: Is File Message needs a phone to answer: no phone, no branch", () => {
  assert.equal(isFile("imageMessage", ""), false);
  assert.equal(isFile("imageMessage", null), false);
});

test("the guard expression and the app agree on every message type the app knows", () => {
  for (const type of ["audioMessage", "imageMessage", "videoMessage", "documentMessage", "documentWithCaptionMessage", "stickerMessage", "reactionMessage", "protocolMessage", "locationMessage", "contactMessage", "x"]) {
    assert.equal(isFile(type), classifyInbound(type) === "file", type);
  }
});

test("the two new If nodes are written in loose mode, so an odd value goes to false instead of failing", () => {
  const start = DOC.indexOf("## N1.");
  const n1 = DOC.slice(start, DOC.indexOf("## N2."));
  for (const guardName of ["Guard: Is File Message", "Guard: Media Reply"]) {
    const at = n1.indexOf(guardName);
    assert.ok(at > 0, `${guardName} is described`);
    assert.match(n1.slice(at, at + 900), /typeValidation[^\n]*loose[\s\S]{0,200}looseTypeValidation/i, `${guardName} says loose + looseTypeValidation`);
  }
});

test("N3 is checked in smoke test H12 (a real booking must give claimUnbacked false), not by reading old executions", () => {
  const n3 = DOC.slice(DOC.indexOf("## N3."));
  assert.match(n3, /H12/);
  assert.match(n3, /claimUnbacked[^\n]*false/i);
  assert.match(n3, /ejecuciones viejas/i);
});

test("the document says N1 goes only after the deploy and that the guard starts in shadow mode", () => {
  assert.match(DOC, /N1 solo después de desplegar/);
  assert.match(DOC, /MODO SOMBRA|modo sombra/);
  assert.match(DOC, /unas 100 conversaciones/);
});

test("the document carries no secret and no provider name for the customer", () => {
  assert.doesNotMatch(DOC, /sk-[A-Za-z0-9]{10,}|Bearer\s+[A-Za-z0-9._-]{15,}|x-internal-key:\s*\S{8,}/);
});
