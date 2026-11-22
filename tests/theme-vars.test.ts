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

// Decision of 2026-11-20 (wave of 23-nov): the 2026-11-11 "white on every primary fill" rule is replaced, because
// white on a light business color (#ffaca3, newy and doctorgcenter) read at 1.8:1.
test("the theme variables carry the readable text color of the primary color", () => {
  assert.equal(themeColorVars({ primaryColor: "#faa096" })["--on-primary"], "#111827");
  assert.equal(themeColorVars({ primaryColor: "#ffaca3" })["--on-primary"], "#111827");
  assert.equal(themeColorVars({ primaryColor: "#1d4ed8" })["--on-primary"], "#ffffff");
  assert.equal(themeColorVars({})["--on-primary"], "#111827"); // default green: dark text contrasts more
});

function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("the text on the primary color reaches 4.5:1 for light and dark business colors", () => {
  for (const primary of ["#ffaca3", "#faa096", "#fde047", "#16a34a", "#1d4ed8", "#111827", "#7f1d1d"]) {
    const text = themeColorVars({ primaryColor: primary })["--on-primary"];
    assert.ok(contrast(primary, text) >= 4.5, `${primary} with ${text}: ${contrast(primary, text).toFixed(2)}`);
  }
});
