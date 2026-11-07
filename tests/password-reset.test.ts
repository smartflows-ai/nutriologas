// local-utils/password-reset.test.ts
// Run: npx tsx --test local-utils/password-reset.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  requestResetCode,
  confirmResetCode,
  resetMessage,
  type ResetDeps,
  type ResetUser,
  type ResetTenant,
} from "../src/lib/password-reset";
import { hashResetCode, RESET_CODE_TTL_MS } from "../src/lib/password-reset-code";

const SECRET = "test-secret-with-enough-length";
const NOW = new Date("2026-11-06T12:00:00.000Z");
const TENANT: ResetTenant = { id: "t1", name: "Clinica Demo", whatsappNumber: "+525512345678", messageLanguage: "es" };
const CODE = "482915";

function makeUser(overrides: Partial<ResetUser> = {}): ResetUser {
  return {
    id: "u1",
    email: "owner@example.com",
    role: "ADMIN",
    passwordHash: "$2b$12$existinghash",
    passwordResetCodeHash: null,
    passwordResetExpiresAt: null,
    passwordResetAttempts: 0,
    ...overrides,
  };
}

function makeDeps(user: ResetUser | null, tenant: ResetTenant | null = TENANT) {
  const sent: { to: string; text: string }[] = [];
  const saved: { userId: string; hash: string; expiresAt: Date }[] = [];
  const attemptsBumped: string[] = [];
  const passwords: { userId: string; hash: string }[] = [];
  const deps: ResetDeps = {
    findCrmUserByEmail: async () => user,
    findTenant: async () => tenant,
    saveResetCode: async (userId, hash, expiresAt) => {
      saved.push({ userId, hash, expiresAt });
    },
    bumpAttempts: async (userId) => {
      attemptsBumped.push(userId);
    },
    saveNewPassword: async (userId, hash) => {
      passwords.push({ userId, hash });
    },
    sendCode: async (to, text) => {
      sent.push({ to, text });
      return { success: true };
    },
    hashPassword: async (value) => `hashed:${value}`,
    generateCode: () => CODE,
    secret: SECRET,
    now: () => NOW,
  };
  return { deps, sent, saved, attemptsBumped, passwords };
}

// ---- request ----

test("request stores a hashed code and sends it to the owner's number", async () => {
  const { deps, sent, saved } = makeDeps(makeUser());
  const result = await requestResetCode(deps, TENANT.id, "owner@example.com");
  assert.equal(result, "sent");
  assert.equal(saved.length, 1);
  assert.equal(saved[0].hash, hashResetCode(CODE, SECRET));
  assert.equal(saved[0].hash.includes(CODE), false);
  assert.equal(saved[0].expiresAt.getTime(), NOW.getTime() + RESET_CODE_TTL_MS);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, TENANT.whatsappNumber);
  assert.equal(sent[0].text.includes(CODE), true);
});

test("request for an unknown email does nothing and says so only internally", async () => {
  const { deps, sent, saved } = makeDeps(null);
  assert.equal(await requestResetCode(deps, TENANT.id, "nobody@example.com"), "no_account");
  assert.equal(sent.length, 0);
  assert.equal(saved.length, 0);
});

test("request without an owner number does nothing", async () => {
  const { deps, sent } = makeDeps(makeUser(), { ...TENANT, whatsappNumber: null });
  assert.equal(await requestResetCode(deps, TENANT.id, "owner@example.com"), "no_destination");
  assert.equal(sent.length, 0);
});

test("a failed WhatsApp send is reported internally, not as a success", async () => {
  const { deps } = makeDeps(makeUser());
  deps.sendCode = async () => ({ success: false });
  assert.equal(await requestResetCode(deps, TENANT.id, "owner@example.com"), "send_failed");
});

// ---- confirm ----

test("confirm with the right code sets the new password and clears the reset fields", async () => {
  const user = makeUser({
    passwordResetCodeHash: hashResetCode(CODE, SECRET),
    passwordResetExpiresAt: new Date(NOW.getTime() + 60_000),
  });
  const { deps, passwords } = makeDeps(user);
  const result = await confirmResetCode(deps, TENANT.id, "owner@example.com", CODE, "a new long phrase", "a new long phrase");
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(passwords, [{ userId: "u1", hash: "hashed:a new long phrase" }]);
});

test("confirm with a wrong code counts an attempt and does not change the password", async () => {
  const user = makeUser({
    passwordResetCodeHash: hashResetCode(CODE, SECRET),
    passwordResetExpiresAt: new Date(NOW.getTime() + 60_000),
  });
  const { deps, passwords, attemptsBumped } = makeDeps(user);
  const result = await confirmResetCode(deps, TENANT.id, "owner@example.com", "000000", "a new long phrase", "a new long phrase");
  assert.deepEqual(result, { ok: false, reason: "wrong_code" });
  assert.deepEqual(attemptsBumped, ["u1"]);
  assert.equal(passwords.length, 0);
});

test("confirm with an expired code is refused without a comparison", async () => {
  const user = makeUser({
    passwordResetCodeHash: hashResetCode(CODE, SECRET),
    passwordResetExpiresAt: new Date(NOW.getTime() - 1),
  });
  const { deps, passwords } = makeDeps(user);
  const result = await confirmResetCode(deps, TENANT.id, "owner@example.com", CODE, "a new long phrase", "a new long phrase");
  assert.deepEqual(result, { ok: false, reason: "expired" });
  assert.equal(passwords.length, 0);
});

test("confirm for an unknown email answers like a wrong code", async () => {
  const { deps } = makeDeps(null);
  const result = await confirmResetCode(deps, TENANT.id, "nobody@example.com", CODE, "a new long phrase", "a new long phrase");
  assert.deepEqual(result, { ok: false, reason: "wrong_code" });
});

test("confirm refuses a new password that breaks the shared rules", async () => {
  const user = makeUser({
    passwordResetCodeHash: hashResetCode(CODE, SECRET),
    passwordResetExpiresAt: new Date(NOW.getTime() + 60_000),
  });
  const { deps, passwords } = makeDeps(user);
  const result = await confirmResetCode(deps, TENANT.id, "owner@example.com", CODE, "short", "short");
  assert.deepEqual(result, { ok: false, reason: "password_too_short" });
  assert.equal(passwords.length, 0);
});

test("confirm refuses when the two new passwords differ", async () => {
  const user = makeUser({
    passwordResetCodeHash: hashResetCode(CODE, SECRET),
    passwordResetExpiresAt: new Date(NOW.getTime() + 60_000),
  });
  const { deps, passwords } = makeDeps(user);
  const result = await confirmResetCode(deps, TENANT.id, "owner@example.com", CODE, "a new long phrase", "another long phrase");
  assert.deepEqual(result, { ok: false, reason: "password_mismatch" });
  assert.equal(passwords.length, 0);
});

test("after five wrong codes even the right code is refused", async () => {
  const user = makeUser({
    passwordResetCodeHash: hashResetCode(CODE, SECRET),
    passwordResetExpiresAt: new Date(NOW.getTime() + 60_000),
    passwordResetAttempts: 5,
  });
  const { deps, passwords } = makeDeps(user);
  const result = await confirmResetCode(deps, TENANT.id, "owner@example.com", CODE, "a new long phrase", "a new long phrase");
  assert.deepEqual(result, { ok: false, reason: "too_many_attempts" });
  assert.equal(passwords.length, 0);
});

// ---- message ----

test("message names the business and the code, and says it expires in 5 minutes", () => {
  const text = resetMessage({ name: "Clinica Demo", messageLanguage: "es" }, "482915");
  assert.equal(text.includes("*Clinica Demo*"), true);
  assert.equal(text.includes("*482915*"), true);
  assert.equal(text.includes("*5 minutos*"), true);
});

test("message in English when the business uses English", () => {
  const text = resetMessage({ name: "Clinic", messageLanguage: "en" }, "482915");
  assert.equal(text.includes("*5 minutes*"), true);
  assert.equal(text.includes("*Newy*"), true);
});

test("message is split into lines, with the name and code in bold", () => {
  const text = resetMessage({ name: "Clinica Demo", messageLanguage: "es" }, "482915");
  assert.equal(text.split("\n").length >= 5, true);
  assert.equal(text.includes("\n\n*482915*\n\n"), true);
});

test("business name with WhatsApp formatting characters cannot break the bold", () => {
  const text = resetMessage({ name: "Dr *G* _Center_", messageLanguage: "es" }, "482915");
  assert.equal(text.includes("*Dr G Center*"), true);
});

test("message does not mention technical providers", () => {
  const text = resetMessage({ name: "Clinica Demo", messageLanguage: "es" }, "482915").toLowerCase();
  for (const word of ["evolution", "n8n", "openrouter", "whatsapp api"]) {
    assert.equal(text.includes(word), false, word);
  }
});

// ── Team members (STAFF) recover through the business owner ─────────────────────────────────────────
// The code still goes to the business WhatsApp; the message names who asked, so the owner decides.

const STAFF = { role: "STAFF" as const, email: "ana@ejemplo.com" };

test("a STAFF request sends the code to the business number, naming who asked", async () => {
  const { deps, sent, saved } = makeDeps(makeUser({ id: "s1", ...STAFF }));
  assert.equal(await requestResetCode(deps, "t1", STAFF.email), "sent");
  assert.equal(saved[0].userId, "s1");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, TENANT.whatsappNumber);
  assert.match(sent[0].text, /Una persona de tu equipo \(\*ana@ejemplo\.com\*\)/);
  assert.match(sent[0].text, /\*482915\*/);
});

test("an owner request keeps the owner message, without the team line", async () => {
  const { deps, sent } = makeDeps(makeUser());
  await requestResetCode(deps, "t1", "owner@example.com");
  assert.doesNotMatch(sent[0].text, /equipo/);
  assert.match(sent[0].text, /Aquí tienes tu código/);
});

test("team message: Spanish names the business, the code, the expiry and that ignoring keeps the password", () => {
  const text = resetMessage({ name: "ElFars", messageLanguage: "es" }, "482915", STAFF.email);
  assert.match(text, /pidió restablecer su contraseña de \*ElFars\*/);
  assert.match(text, /Si la reconoces, compártele este código:/);
  assert.match(text, /Vence en \*5 minutos\*/);
  assert.match(text, /su contraseña no cambia/);
});

test("team message in English when the business uses English", () => {
  const text = resetMessage({ name: "Clinic", messageLanguage: "en" }, "482915", STAFF.email);
  assert.match(text, /Someone on your team \(\*ana@ejemplo\.com\*\) asked to reset their password for \*Clinic\*/);
  assert.match(text, /\*482915\*/);
});

test("WhatsApp formatting characters in the team email cannot break the bold", () => {
  const text = resetMessage({ name: "ElFars", messageLanguage: "es" }, "482915", "a*n_a~@x`y.com");
  assert.match(text, /\(\*ana@xy\.com\*\)/);
});

test("a STAFF member sets the new password with the right code", async () => {
  const user = makeUser({
    id: "s1",
    ...STAFF,
    passwordResetCodeHash: hashResetCode(CODE, SECRET),
    passwordResetExpiresAt: new Date(NOW.getTime() + RESET_CODE_TTL_MS),
  });
  const { deps, passwords } = makeDeps(user);
  const result = await confirmResetCode(deps, "t1", STAFF.email, CODE, "Nueva-clave-2026", "Nueva-clave-2026");
  assert.deepEqual(result, { ok: true });
  assert.equal(passwords[0].userId, "s1");
});

test("the database lookup accepts ADMIN and STAFF accounts only, never customers", () => {
  const src = readFileSync(path.join(__dirname, "..", "src", "lib", "password-reset-data.ts"), "utf8");
  assert.match(src, /role:\s*\{\s*in:\s*\[ADMIN_ROLE,\s*STAFF_ROLE\]\s*\}/);
  assert.doesNotMatch(src, /CUSTOMER/);
});
