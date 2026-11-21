// tests/ola-23-nov-wiring.test.ts
// Reads the source (no database) to check the routes use the shared rules of the 23-nov wave
// (tickets #128, #127, #74, #129 and the readable text on the primary color). Run with:
// npx tsx --test tests/ola-23-nov-wiring.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel: string): string => readFileSync(path.join(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

test("bot/context shows the patient through contextPatientView, so a name without a surname is asked (#128)", () => {
  const src = read("src/app/api/internal/bot/context/route.ts");
  assert.match(src, /patient: contextPatientView\(known\)/);
  assert.doesNotMatch(src, /name: known\.name/);
  assert.match(src, /intake: intakeNeeds\(known\)/);
});
