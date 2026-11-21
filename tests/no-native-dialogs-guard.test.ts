// tests/no-native-dialogs-guard.test.ts
// Ticket #138: the browser's own confirm(), alert() and prompt() boxes ignore the business colors, dark mode and
// language. Every confirmation uses the shared ConfirmModal, and every message uses the page's own UI.
// This test reads src/ and fails when a file calls one of the native dialogs.
// Run with: npx tsx --test tests/no-native-dialogs-guard.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.join(__dirname, "..", "src");
// confirm( / alert( / prompt( as a bare or window.* call, not a method (foo.confirm) or a longer name (onConfirm).
const NATIVE_DIALOG = /(?<![\w$.])(?:window\.)?(?:confirm|alert|prompt)\s*\(/g;

interface SourceFile {
  readonly rel: string;
  readonly text: string;
}

function sourceFiles(dir: string): SourceFile[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.(ts|tsx)$/.test(name)) return [];
    return [{ rel: path.relative(SRC, full), text: readFileSync(full, "utf8") }];
  });
}

// Comments may mention the words; blank them out and keep the line breaks so line numbers stay right.
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/^\s*\/\/.*$/gm, "");
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

const FILES = sourceFiles(SRC);

test("the scan reads the source tree (sanity check)", () => {
  assert.ok(FILES.length > 100, `expected more than 100 source files, found ${FILES.length}`);
});

test("the pattern catches the native calls and ignores look-alikes", () => {
  const hits = (s: string) => Array.from(s.matchAll(NATIVE_DIALOG)).length;
  assert.equal(hits("if (!confirm(msg)) return;"), 1);
  assert.equal(hits("window.alert(msg)"), 1);
  assert.equal(hits("const v = prompt('x')"), 1);
  assert.equal(hits(withoutComments("{/* Feedback alert (Error) */}\n// confirm(x)")), 0);
  assert.equal(hits("onConfirm(); handleConfirm(); modal.confirm(); t.confirmCancel"), 0);
});

test("no source file calls a native confirm(), alert() or prompt()", () => {
  const found = FILES.flatMap((f) =>
    Array.from(withoutComments(f.text).matchAll(NATIVE_DIALOG)).map((m) => `${f.rel}:${lineOf(f.text, m.index ?? 0)} ${m[0]}`)
  );
  assert.deepEqual(found, [], `use ConfirmModal (confirmations) or an inline message instead of:\n${found.join("\n")}`);
});
