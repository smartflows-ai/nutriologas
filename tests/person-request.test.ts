// The guard before the agent: an explicit request for a person is sent to the team even when the model does not call
// request_human_help. These tests protect every other flow: no false positives on booking, prices, greetings or
// complaints, and no change to what the agent receives. The workflow checks read the local n8n file when it exists
// (it is not in git, so they skip on a clean checkout).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { asksForPerson, PERSON_REQUEST_PATTERN } from "../src/lib/person-request";

const ROOT = path.resolve(__dirname, "..");
const WORKFLOW = path.join(ROOT, "n8n", "workflows", "n8n-chat-workflow-v3.json");
const hasWorkflow = existsSync(WORKFLOW);
const skip = hasWorkflow ? false : "local n8n workflow not present";

const ASKS_FOR_PERSON = [
  "quiero hablar con alguien",
  "Quiero hablar con una persona, por favor",
  "necesito hablar con un humano",
  "¿me pueden pasar con un asesor?",
  "pásame con una persona",
  "quiero atención humana",
  "que me llamen por favor",
  "me pueden llamar?",
  "quiero hablar con alguien real",
  "quiero que me atienda alguien del equipo",
  "hablar con un asesor",
];

const DOES_NOT_ASK_FOR_PERSON = [
  // booking, including for another person
  "Quiero agendar una cita para otra persona",
  "es para otra persona, mi hijo",
  "¿tienen lugar mañana a las 10?",
  "quiero agendar",
  "Omar Galindo 34",
  "A las 15?",
  "No",
  "15:30",
  // the word "persona" or "alguien" in another sense
  "cuantas personas caben en la clase",
  "tengo dos personas, ¿hay lugar?",
  "el doctor es una persona muy amable",
  // prices, purchases, greetings, complaints (the agent handles these)
  "¿cuánto cuesta la consulta?",
  "quiero comprarlo",
  "hola buenas tardes",
  "Pésimo servicio",
  "me gustaría cambiar mi cita",
  // another person named in a sentence that is not a request for a person
  "quiero hablar con mi esposa sobre la cita",
  "quiero que me atienda el doctor Pérez",
];

test("an explicit request for a person is detected, with or without accents and capitals", () => {
  for (const text of ASKS_FOR_PERSON) assert.equal(asksForPerson(text), true, text);
});

test("booking, prices, greetings and complaints are never sent to the team by the guard", () => {
  for (const text of DOES_NOT_ASK_FOR_PERSON) assert.equal(asksForPerson(text), false, text);
});

test("an empty or missing message is not a request", () => {
  assert.equal(asksForPerson(""), false);
  assert.equal(asksForPerson(undefined as unknown as string), false);
});

test("the pattern is a plain regular expression the workflow can reuse", () => {
  assert.ok(PERSON_REQUEST_PATTERN instanceof RegExp);
  assert.equal(PERSON_REQUEST_PATTERN.flags.includes("i"), true, "case insensitive");
});

// ---- The n8n workflow (local file) ----

interface WorkflowNode {
  name: string;
  type: string;
  parameters: Record<string, any>;
  onError?: string;
}
interface Workflow {
  nodes: WorkflowNode[];
  connections: Record<string, Record<string, { node: string; type: string; index: number }[][]>>;
}

function loadWorkflow(): Workflow {
  return JSON.parse(readFileSync(WORKFLOW, "utf8")) as Workflow;
}

/** Every connection as "from [type port] -> to", all connection types (main, ai_tool, ai_languageModel, ai_memory). */
function edgesOf(w: Workflow): string[] {
  const out: string[] = [];
  for (const [from, byType] of Object.entries(w.connections)) {
    for (const [type, ports] of Object.entries(byType)) {
      ports.forEach((port, portIndex) => {
        for (const to of port ?? []) out.push(`${from} [${type} ${portIndex}] -> ${to.node}`);
      });
    }
  }
  return out.sort();
}

const AGENT_INPUTS_BEFORE_THIS_CHANGE = [
  "Fallback Chat Model [ai_languageModel 0] -> Bot Agent",
  "Guard: Credits OK [main 0] -> Bot Agent",
  "OpenRouter Chat Model [ai_languageModel 0] -> Bot Agent",
  "Postgres Chat Memory [ai_memory 0] -> Bot Agent",
  "book_appointment [ai_tool 0] -> Bot Agent",
  "cancel_appointment [ai_tool 0] -> Bot Agent",
  "check_availability [ai_tool 0] -> Bot Agent",
  "confirm_appointment [ai_tool 0] -> Bot Agent",
  "list_my_appointments [ai_tool 0] -> Bot Agent",
  "request_human_help [ai_tool 0] -> Bot Agent",
  "reschedule_appointment [ai_tool 0] -> Bot Agent",
];

const CREDITS_GUARD_OUTPUTS_BEFORE_THIS_CHANGE = [
  "Guard: Credits OK [main 0] -> Bot Agent",
  "Guard: Credits OK [main 1] -> Mark Help: Credits Exhausted",
  "Guard: Credits OK [main 1] -> Write Bot Message: Credits Exhausted",
];

test("the guard node exists and is an IF node", { skip }, () => {
  const guard = loadWorkflow().nodes.find((n) => n.name === "Guard: Person Request");
  assert.ok(guard, "Guard: Person Request exists");
  assert.equal(guard.type, "n8n-nodes-base.if");
});

test("the guard's expression uses the module's pattern and reads the customer's text", { skip }, () => {
  const guard = loadWorkflow().nodes.find((n) => n.name === "Guard: Person Request");
  assert.ok(guard);
  const leftValueText: string = guard.parameters.conditions.conditions[0].leftValue;
  assert.ok(leftValueText.includes(PERSON_REQUEST_PATTERN.source), "same pattern as src/lib/person-request.ts");

  // Simulate n8n: the expression reads the text from "Extract Message" and returns true or false.
  const leftValue: string = guard.parameters.conditions.conditions[0].leftValue;
  const expr = leftValue.replace(/^=\{\{\s*/, "").replace(/\s*\}\}$/, "");
  const run = (text: string | undefined): boolean => {
    const $ = (name: string) => {
      assert.equal(name, "Extract Message", "reads the message from Extract Message");
      return { first: () => ({ json: { text } }) };
    };
    return new Function("$", `return (${expr});`)($) as boolean;
  };
  for (const text of ASKS_FOR_PERSON) assert.equal(run(text), true, text);
  for (const text of DOES_NOT_ASK_FOR_PERSON) assert.equal(run(text), false, text);
  assert.equal(run(undefined), false, "a missing text does not break the flow");
});

test("the request is sent with the reason person_requested, like the other help calls, and never stops the flow", { skip }, () => {
  const http = loadWorkflow().nodes.find((n) => n.name === "Mark Help: Person Request");
  assert.ok(http, "Mark Help: Person Request exists");
  assert.equal(http.type, "n8n-nodes-base.httpRequest");
  assert.equal(http.parameters.url, "https://www.newaigent.com/api/internal/bot/help");
  assert.equal(http.parameters.method, "POST");
  const body = String(http.parameters.body);
  assert.ok(body.includes("reason: 'person_requested'"));
  assert.ok(body.includes("customerPhone"));
  assert.ok(body.includes("instance"));
  assert.equal(http.onError, "continueRegularOutput", "a failed call is ignored");
});

test("the new branch only adds edges: the agent keeps the same inputs and the credits guard keeps its outputs", { skip }, () => {
  const w = loadWorkflow();
  const edges = edgesOf(w);
  for (const edge of AGENT_INPUTS_BEFORE_THIS_CHANGE) assert.ok(edges.includes(edge), `kept: ${edge}`);
  assert.deepEqual(
    edges.filter((edge) => edge.endsWith("-> Bot Agent")),
    AGENT_INPUTS_BEFORE_THIS_CHANGE,
    "no new input for the agent"
  );
  for (const edge of CREDITS_GUARD_OUTPUTS_BEFORE_THIS_CHANGE) assert.ok(edges.includes(edge), `kept: ${edge}`);
  // The only new outgoing edge of the credits guard goes to the new guard.
  assert.ok(edges.includes("Guard: Credits OK [main 0] -> Guard: Person Request"));
});

test("the new nodes lead nowhere else: the guard only calls the help route, and that call has no output", { skip }, () => {
  const edges = edgesOf(loadWorkflow());
  const fromGuard = edges.filter((edge) => edge.startsWith("Guard: Person Request "));
  assert.deepEqual(fromGuard, ["Guard: Person Request [main 0] -> Mark Help: Person Request"]);
  assert.deepEqual(edges.filter((edge) => edge.startsWith("Mark Help: Person Request ")), [], "no output: it cannot change the reply");
});

test("the workflow has exactly the 45 original nodes plus the 2 new ones, and no cycle or dangling link", { skip }, () => {
  const w = loadWorkflow();
  assert.equal(w.nodes.length, 47);
  const names = new Set(w.nodes.map((n) => n.name));
  assert.equal(names.size, w.nodes.length, "names are unique");
  const adj = new Map<string, string[]>();
  for (const edge of edgesOf(w)) {
    const from = edge.split(" [")[0];
    const to = edge.split(" -> ")[1];
    assert.ok(names.has(from) && names.has(to), `both ends exist: ${edge}`);
    adj.set(from, [...(adj.get(from) ?? []), to]);
  }
  const state = new Map<string, number>();
  const visit = (node: string): void => {
    state.set(node, 1);
    for (const next of adj.get(node) ?? []) {
      assert.notEqual(state.get(next), 1, `cycle through ${next}`);
      if (!state.has(next)) visit(next);
    }
    state.set(node, 2);
  };
  for (const name of Array.from(names)) if (!state.has(name)) visit(name);
});
