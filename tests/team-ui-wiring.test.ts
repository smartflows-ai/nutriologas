// tests/team-ui-wiring.test.ts
// Run: npx tsx --test tests/team-ui-wiring.test.ts
// The team screen (ticket #22): registry, menu, gates and i18n stay wired together.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CAPABILITIES, visibleCapabilities, type CapabilityContext } from "../src/lib/capabilities";
import { canAccessAdminPath } from "../src/lib/permissions";
import { es } from "../src/i18n/es";
import { en } from "../src/i18n/en";

const readRoot = (rel: string) => readFileSync(path.join(__dirname, "..", rel), "utf8");
const TEAM_ROUTE = "/admin/equipo";

const ctx = (plan: CapabilityContext["plan"], vertical = "HEALTH"): CapabilityContext => ({
  vertical,
  plan,
  isBookingEnabled: false,
  isAssistantEnabled: false,
  isTriageEnabled: false,
  connectedApps: [],
  enabledTools: [],
});

test("the team screen is in the registry for every plan and vertical, with no flag or activation", () => {
  const team = CAPABILITIES.find((c) => c.route === TEAM_ROUTE);
  assert.ok(team);
  assert.equal(team.enforcedPlan, "START");
  assert.equal(team.verticals, "all");
  assert.deepEqual(team.gates, {});
  assert.notEqual(team.activatable, true);
  for (const plan of ["START", "PLUS", "PRO"] as const) {
    for (const vertical of ["HEALTH", "ECOMMERCE", "TOURISM"]) {
      assert.ok(visibleCapabilities(ctx(plan, vertical)).some((c) => c.route === TEAM_ROUTE), `${plan} ${vertical}`);
    }
  }
});

test("the menu lists the team screen and the role filter hides it from STAFF", () => {
  assert.match(readRoot("src/components/admin/AdminSidebar.tsx"), /href: "\/admin\/equipo", label: t\.admin\.team/);
  assert.equal(canAccessAdminPath("STAFF", TEAM_ROUTE), false);
});

test("the team page has its own server gate", () => {
  assert.match(readRoot("src/app/admin/equipo/page.tsx"), /requireAdminPage\("\/admin\/equipo"\)/);
});

test("the change-password page decides on the server who may see it", () => {
  const page = readRoot("src/app/(auth)/cambiar-contrasena/page.tsx");
  assert.match(page, /getSessionAccess\(/);
  assert.match(page, /redirect\(LOGIN_PATH\)/);
});

test("the admin layout watches the session on every section change", () => {
  assert.match(readRoot("src/app/admin/layout.tsx"), /<SessionWatch \/>/);
  const watch = readRoot("src/components/admin/SessionWatch.tsx");
  assert.match(watch, /usePathname\(/);
  assert.match(watch, /lockedDestination\(/);
});

test("a user with a temporary password lands on the change screen right after signing in", () => {
  const source = readRoot("src/lib/home-after-sign-in.ts");
  assert.match(source, /mustChangePassword/);
  assert.match(source, /CHANGE_PASSWORD_PATH/);
});

test("the temporary password is never kept in browser storage or put in a URL", () => {
  for (const rel of ["TeamManager.tsx", "TempPasswordDialog.tsx", "NewTeamUserForm.tsx", "TeamUserRow.tsx", "useTeam.ts"]) {
    const source = readRoot(`src/components/admin/team/${rel}`);
    assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|searchParams|router\.push\([^)]*assword/, rel);
    assert.doesNotMatch(source, /dangerouslySetInnerHTML/, rel);
  }
});

function keysOf(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key));
}

test("the new texts exist in Spanish and English with the same keys and placeholders, and no emojis", () => {
  for (const section of ["team", "passwordChange"] as const) {
    assert.deepEqual(keysOf(es[section]).sort(), keysOf(en[section]).sort(), section);
    for (const key of keysOf(es[section])) {
      const read = (dict: unknown) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], dict) as string;
      const [a, b] = [read(es[section]), read(en[section])];
      assert.ok(a.trim().length > 0 && b.trim().length > 0, key);
      assert.deepEqual(a.match(/\{\w+\}/g)?.sort() ?? [], b.match(/\{\w+\}/g)?.sort() ?? [], `${section}.${key} placeholders`);
      // Emoji live in the surrogate pairs and in the symbol blocks below.
      assert.doesNotMatch(a + b, /[\uD83C-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/, `${section}.${key}`);
    }
  }
  assert.equal(es.admin.team, "Equipo");
  assert.equal(en.admin.team, "Team");
});

test("a team action cannot run twice at once, and the confirm button is disabled while it runs", () => {
  const hook = readRoot("src/components/admin/team/useTeam.ts");
  assert.match(hook, /if \(isRunning\.current\) return \{ isDone: false \};/);
  assert.match(readRoot("src/components/admin/team/TeamManager.tsx"), /isBusy=\{isBusy\}/);
  assert.match(readRoot("src/components/admin/ConfirmModal.tsx"), /disabled=\{isBusy\}/);
});

test("the temporary password dialog announces itself and takes the focus", () => {
  const dialog = readRoot("src/components/admin/team/TempPasswordDialog.tsx");
  assert.match(dialog, /role="alertdialog"/);
  assert.match(dialog, /autoFocus/);
});

test("the change-password form drops the last error as soon as a field is edited", () => {
  const form = readRoot("src/components/auth/ChangePasswordForm.tsx");
  assert.match(form, /onChange=\{\(field, value\) => \{[^}]*setError\(null\);/);
});
