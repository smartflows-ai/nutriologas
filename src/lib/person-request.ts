// src/lib/person-request.ts
// The deterministic guard before the WhatsApp agent: a customer who explicitly asks for a person is handed to the team
// even when the model does not call request_human_help. Only explicit wording counts, so booking for another person,
// prices, greetings and complaints never match (the agent keeps those). The same pattern is written in the n8n guard
// "Guard: Person Request"; "comunicar con" + any destination counts (ticket #143); tests/person-request.test.ts checks that both stay equal and run it on the real node.
// Pure: no I/O.

export const PERSON_REQUEST_PATTERN =
  /\b(hablar|platicar|hable|hablo)\s+con\s+(una?\s+|un\s+)?(persona|humano|asesor|alguien)\b|\b(quiero|necesito|prefiero)\s+(una?\s+|un\s+)?(persona|humano|asesor)\b|\bpersona\s+real\b|\batenci[oó]n\s+humana\b|\b(alguien|asesor|persona|humano)\s+del\s+equipo\b|\bp[aá]s(ar|ame|a|e)\s+(me\s+)?con\s+(una?\s+|un\s+)?(persona|humano|asesor|alguien)\b|\bme\s+(pueden\s+)?(llame|llamen|llamar|marquen)\b|\bque\s+me\s+(llame|llamen|marquen)\b|\b(comun[ií]c(ame|anos)|(me|nos)\s+(pued(es|en)\s+|podr[ií](as|an)\s+)?(comunic(ar|as|an)|comuniqu(en|es)))\s+con\b/i;

/** True when the customer's message explicitly asks for a person of the team. */
export function asksForPerson(text: string | null | undefined): boolean {
  if (typeof text !== "string" || text.trim() === "") return false;
  return PERSON_REQUEST_PATTERN.test(text);
}
