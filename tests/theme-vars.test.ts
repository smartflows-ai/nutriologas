// tests/theme-vars.test.ts
// Text color placed on the tenant's primary color must stay readable for any tenant color, light or dark.
// Run with: npx tsx --test tests/theme-vars.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readableTextOn, themeColorVars } from "../src/lib/theme-vars";

test("white text on dark colors", () => {
  assert.equal(readableTextOn("17 24 39"), "#ffffff");
  assert.equal(readableTextOn("37 99 235"), "#ffffff");
  assert.equal(readableTextOn("127 29 29"), "#ffffff");
});

test("dark text on light and mid-light colors such as a soft pink, yellow or the default green", () => {
  assert.equal(readableTextOn("22 163 74"), "#111827"); // the default green: dark text contrasts more than white
  assert.equal(readableTextOn("250 160 150"), "#111827");
  assert.equal(readableTextOn("253 224 71"), "#111827");
  assert.equal(readableTextOn("255 255 255"), "#111827");
});

test("an unreadable value falls back to white", () => {
  assert.equal(readableTextOn(""), "#ffffff");
  assert.equal(readableTextOn("not a color"), "#ffffff");
});

test("the theme variables carry the readable text color of the primary color", () => {
  assert.equal(themeColorVars({ primaryColor: "#faa096" })["--on-primary"], "#111827");
  assert.equal(themeColorVars({ primaryColor: "#1d4ed8" })["--on-primary"], "#ffffff");
  assert.equal(themeColorVars({})["--on-primary"], "#111827"); // default green
});
