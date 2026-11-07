// Tests for src/lib/permissions.ts (ticket #21: STAFF role).
// Run: npx tsx --test local-utils/permissions.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { CapabilityContext, CapabilityPlan } from "../src/lib/capabilities";
import {
  PERMISSIONS,
  can,
  canAccessAdminPath,
  canUseCapability,
  isCrmRole,
  omitClinicalNotes,
  omitNoteCounts,
  omitPatientNotes,
  permissionStatus,
  roleHomePath,
  staffHomePath,
  type Permission,
} from "../src/lib/permissions";

const STAFF_ALLOWED: readonly Permission[] = [
  "appointments.view",
  "appointments.status",
  "appointments.reschedule",
  "appointments.book",
  "whatsapp.chats",
  "whatsapp.bot",
  "whatsapp.confirmations",
  "whatsapp.settings",
  "history.view",
];
const STAFF_DENIED: readonly Permission[] = ["appointments.notes", "appointments.delete", "whatsapp.chats.delete"];

function ctx(plan: CapabilityPlan, overrides: Partial<CapabilityContext> = {}): CapabilityContext {
  return {
    vertical: "HEALTH",
    plan,
    isBookingEnabled: true,
    isAssistantEnabled: true,
    isTriageEnabled: true,
    connectedApps: ["WHATSAPP"],
    enabledTools: ["history"],
    ...overrides,
  };
}

// ── can() ─────────────────────────────────────────────────────────────────────

test("the permission list is exactly the STAFF table of the plan", () => {
  assert.deepEqual([...PERMISSIONS].sort(), [...STAFF_ALLOWED, ...STAFF_DENIED].sort());
});

test("ADMIN can do everything", () => {
  for (const p of PERMISSIONS) assert.equal(can("ADMIN", p), true, p);
});

test("STAFF can do only the permissions marked yes", () => {
  for (const p of STAFF_ALLOWED) assert.equal(can("STAFF", p), true, p);
  for (const p of STAFF_DENIED) assert.equal(can("STAFF", p), false, p);
});

test("CUSTOMER, an unknown role and a missing role can do nothing", () => {
  for (const role of ["CUSTOMER", "SUPERADMIN", "staff", "admin", "", null, undefined]) {
    for (const p of PERMISSIONS) assert.equal(can(role, p), false, `${String(role)} ${p}`);
  }
});

test("a permission without an entry is ADMIN only", () => {
  const unknown = "billing.manage" as Permission;
  assert.equal(can("ADMIN", unknown), true);
  assert.equal(can("STAFF", unknown), false);
});

// ── permissionStatus() (pure core of requirePermission) ─────────────────────

test("permissionStatus: 401 without a session or tenant, 403 without the permission, null when allowed", () => {
  assert.equal(permissionStatus(null, "appointments.view"), 401);
  assert.equal(permissionStatus({ user: { role: "ADMIN", tenantId: "" } }, "appointments.view"), 401);
  assert.equal(permissionStatus({ user: { role: "CUSTOMER", tenantId: "t1" } }, "appointments.view"), 403);
  assert.equal(permissionStatus({ user: { role: "STAFF", tenantId: "t1" } }, "appointments.notes"), 403);
  assert.equal(permissionStatus({ user: { role: "STAFF", tenantId: "t1" } }, "appointments.view"), null);
  assert.equal(permissionStatus({ user: { role: "ADMIN", tenantId: "t1" } }, "appointments.delete"), null);
});

// ── canAccessAdminPath() (middleware and sidebar) ─────────────────────────────

test("ADMIN opens every /admin page", () => {
  for (const p of ["/admin", "/admin/dashboard", "/admin/negocio", "/admin/historial/abc", "/admin/suscripcion"]) {
    assert.equal(canAccessAdminPath("ADMIN", p), true, p);
  }
});

test("STAFF opens Citas, WhatsApp, Historial (and subpaths) and the /admin entry", () => {
  for (const p of ["/admin", "/admin/", "/admin/citas", "/admin/citas/", "/admin/whatsapp", "/admin/historial", "/admin/historial/abc"]) {
    assert.equal(canAccessAdminPath("STAFF", p), true, p);
  }
});

test("STAFF does not open other sections, nor look-alike paths", () => {
  for (const p of ["/admin/dashboard", "/admin/negocio", "/admin/productos", "/admin/apps", "/admin/suscripcion",
    "/admin/pedidos", "/admin/asistente", "/admin/citas-x", "/admin/historialx", "/admin/whatsapp2", "/adminx"]) {
    assert.equal(canAccessAdminPath("STAFF", p), false, p);
  }
});

test("CUSTOMER and unknown roles open no /admin page", () => {
  for (const role of ["CUSTOMER", "UNKNOWN", null, undefined]) {
    assert.equal(canAccessAdminPath(role, "/admin"), false);
    assert.equal(canAccessAdminPath(role, "/admin/citas"), false);
  }
});

test("isCrmRole: only ADMIN and STAFF enter the CRM", () => {
  assert.equal(isCrmRole("ADMIN"), true);
  assert.equal(isCrmRole("STAFF"), true);
  for (const role of ["CUSTOMER", "UNKNOWN", "admin", "", null, undefined]) assert.equal(isCrmRole(role), false, String(role));
});

// ── canUseCapability(): role and plan together ───────────────────────────────

test("history needs the role and the plan: Pro only, for ADMIN and STAFF", () => {
  for (const role of ["ADMIN", "STAFF"]) {
    assert.equal(canUseCapability(role, "history", ctx("START")), false, `${role} START`);
    assert.equal(canUseCapability(role, "history", ctx("PLUS")), false, `${role} PLUS`);
    assert.equal(canUseCapability(role, "history", ctx("PRO")), true, `${role} PRO`);
  }
  assert.equal(canUseCapability("CUSTOMER", "history", ctx("PRO")), false);
});

test("history also needs the owner to have activated it", () => {
  assert.equal(canUseCapability("STAFF", "history", ctx("PRO", { enabledTools: [] })), false);
});

test("STAFF never uses an ADMIN-only tool, even if the business has it", () => {
  for (const id of ["dashboard", "products", "business", "apps", "assistant", "social-campaign"]) {
    assert.equal(canUseCapability("STAFF", id, ctx("PRO", { connectedApps: ["WHATSAPP", "FACEBOOK"] })), false, id);
    assert.equal(canUseCapability("ADMIN", id, ctx("PRO", { connectedApps: ["WHATSAPP", "FACEBOOK"] })), true, id);
  }
});

test("confirmations (a WhatsApp tab) follow the WhatsApp section and the Plus plan", () => {
  assert.equal(canUseCapability("STAFF", "confirmations", ctx("START")), false);
  assert.equal(canUseCapability("STAFF", "confirmations", ctx("PLUS")), true);
});

test("an unknown capability is never usable", () => {
  assert.equal(canUseCapability("ADMIN", "does-not-exist", ctx("PRO")), false);
});

// ── Home pages ───────────────────────────────────────────────────────────────

test("staffHomePath: Citas first, then WhatsApp, then Historial, else null (empty screen)", () => {
  assert.equal(staffHomePath(ctx("PRO")), "/admin/citas");
  assert.equal(staffHomePath(ctx("PRO", { isBookingEnabled: false })), "/admin/whatsapp");
  assert.equal(staffHomePath(ctx("START", { isBookingEnabled: false, connectedApps: [] })), null);
});

test("roleHomePath: ADMIN dashboard, STAFF the /admin entry (it resolves the section), others the store", () => {
  assert.equal(roleHomePath("ADMIN"), "/admin/dashboard");
  assert.equal(roleHomePath("STAFF"), "/admin");
  assert.equal(roleHomePath("CUSTOMER"), "/");
  assert.equal(roleHomePath(undefined), "/");
});

// ── omitClinicalNotes() ──────────────────────────────────────────────────────

test("omitClinicalNotes removes internalNotes and notesHistory for STAFF without mutating", () => {
  const original = Object.freeze({ id: "a1", notes: "motivo", internalNotes: "clinica", notesHistory: [{ body: "x" }] });
  const safe = omitClinicalNotes("STAFF", original);
  assert.deepEqual(safe, { id: "a1", notes: "motivo" });
  assert.equal("internalNotes" in original, true);
  assert.equal(original.notesHistory.length, 1);
});

test("omitClinicalNotes keeps everything for ADMIN", () => {
  const original = { id: "a1", internalNotes: "clinica", notesHistory: [] };
  assert.deepEqual(omitClinicalNotes("ADMIN", original), original);
});

test("omitClinicalNotes fails closed: any role that cannot read notes loses them", () => {
  for (const role of ["CUSTOMER", "UNKNOWN", null]) {
    assert.equal("internalNotes" in omitClinicalNotes(role, { id: "a1", internalNotes: "x" }), false, String(role));
  }
});

// ── Wiring: the routes STAFF uses read permissions.ts ────────────────────────

const API = path.join(__dirname, "..", "src", "app", "api");
const read = (rel: string): string => readFileSync(path.join(API, rel), "utf8");

const STAFF_ROUTES = [
  "appointments/route.ts",
  "appointments/[id]/route.ts",
  "calendar/events/route.ts",
  "calendar/account/route.ts",
  "apps/whatsapp/chats/route.ts",
  "apps/whatsapp/chats/[id]/route.ts",
  "apps/whatsapp/chats/[id]/send/route.ts",
  "apps/whatsapp/messages/route.ts",
  "apps/whatsapp/config/route.ts",
  "apps/whatsapp/confirmations/route.ts",
  "apps/whatsapp/confirmations/[id]/route.ts",
  "tenants/reminders/route.ts",
  "admin/historial/route.ts",
  "admin/historial/[key]/route.ts",
];

for (const rel of STAFF_ROUTES) {
  test(`${rel} checks access through permissions.ts`, () => {
    assert.match(read(rel), /from "@\/lib\/(permissions|permission-guard)"/);
  });
}

const NOTE_STRIPPERS: Readonly<Record<string, RegExp>> = {
  "appointments/route.ts": /omitClinicalNotes\(role/,
  "appointments/[id]/route.ts": /omitClinicalNotes\(role/,
  "calendar/events/route.ts": /omitClinicalNotes\(role/,
  "admin/historial/route.ts": /omitNoteCounts\(role/,
  "admin/historial/[key]/route.ts": /omitPatientNotes\(role/,
};
for (const [rel, pattern] of Object.entries(NOTE_STRIPPERS)) {
  test(`${rel} strips clinical notes for roles that cannot read them`, () => {
    assert.match(read(rel), pattern);
  });
}

test("campaigns/social/history is ADMIN only (leak fixed)", () => {
  assert.match(read("campaigns/social/history/route.ts"), /role\s*!==\s*"ADMIN"/);
});

// "Not a customer" must never mean "staff": a negative comparison with CUSTOMER would open access to any other role.
test("no API route lets a request through by comparing the role as not CUSTOMER", () => {
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "route.ts" && /role\s*!==?\s*"CUSTOMER"/.test(readFileSync(full, "utf8"))) offenders.push(full);
    }
  };
  walk(API);
  assert.deepEqual(offenders, []);
});

// ── Wiring: middleware, page gates and home pages (Phase 4) ─────────────────

const ROOT = path.join(__dirname, "..");
const readRoot = (rel: string): string => readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel: string): boolean => existsSync(path.join(ROOT, rel));

test("the middleware lives in src/ (the only place Next.js reads it) and gates /admin with permissions.ts", () => {
  assert.equal(exists("middleware.ts"), false, "root middleware.ts is ignored by Next.js when src/app is used");
  const mw = readRoot("src/middleware.ts");
  assert.match(mw, /canAccessAdminPath/);
  assert.match(mw, /matcher:\s*\[\s*"\/admin"\s*,\s*"\/admin\/:path\*"\s*\]/);
});

test("the admin layout accepts the CRM roles through permissions.ts", () => {
  const layout = readRoot("src/app/admin/layout.tsx");
  assert.match(layout, /isCrmRole/);
  assert.doesNotMatch(layout, /role\s*!==\s*"ADMIN"/);
});

for (const rel of ["dashboard/page.tsx", "asistente/page.tsx", "pedidos/page.tsx", "pedidos/[id]/page.tsx"]) {
  test(`admin/${rel} has its own server gate`, () => {
    assert.match(readRoot(`src/app/admin/${rel}`), /requireAdminPage\(/);
  });
}

test("the /admin entry, login and signup send each role to its home", () => {
  assert.match(readRoot("src/app/admin/page.tsx"), /staffHomePath/);
  assert.match(readRoot("src/lib/home-after-sign-in.ts"), /roleHomePath/);
  assert.match(readRoot("src/app/(auth)/login/page.tsx"), /homeAfterSignIn\(\)/);
  assert.match(readRoot("src/app/(auth)/registro/page.tsx"), /homeAfterSignIn\(\)/);
});

// ── Phase 5: menu and controls by role ──────────────────────────────────────

import { visibleCapabilities } from "../src/lib/capabilities";

function menuRoutes(role: string, c: CapabilityContext): string[] {
  // Same rule as AdminSidebar: visible for the business AND openable by the role.
  return Array.from(new Set(visibleCapabilities(c).map((cap) => cap.route).filter((r) => canAccessAdminPath(role, r)))).sort();
}

test("STAFF menu on Pro with WhatsApp and history: only Citas, WhatsApp and Historial", () => {
  assert.deepEqual(menuRoutes("STAFF", ctx("PRO")), ["/admin/citas", "/admin/historial", "/admin/whatsapp"]);
});

test("STAFF menu on Start: no Historial (plan), still Citas and WhatsApp", () => {
  assert.deepEqual(menuRoutes("STAFF", ctx("START")), ["/admin/citas", "/admin/whatsapp"]);
});

test("ADMIN menu is the full visible list (role adds no filter)", () => {
  const c = ctx("PRO", { connectedApps: ["WHATSAPP", "FACEBOOK"] });
  assert.deepEqual(menuRoutes("ADMIN", c), Array.from(new Set(visibleCapabilities(c).map((cap) => cap.route))).sort());
});

test("the sidebar filters by role and shows credits only to ADMIN", () => {
  const sidebar = readRoot("src/components/admin/AdminSidebar.tsx");
  assert.match(sidebar, /canAccessAdminPath\(role, item\.href\)/);
  assert.equal((sidebar.match(/<CreditsBadge \/>/g) ?? []).length, (sidebar.match(/showCredits && (<div[^>]*>)?<CreditsBadge \/>/g) ?? []).length);
});

test("trial banner and expired gate only offer checkout when the role can manage billing", () => {
  for (const rel of ["src/components/admin/TrialBanner.tsx", "src/components/admin/TrialExpiredGate.tsx"]) {
    const src = readRoot(rel);
    assert.match(src, /canManageBilling \? \(/, rel);
    assert.match(src, /canManageBilling && checkoutOpen/, rel);
  }
  assert.match(readRoot("src/app/admin/layout.tsx"), /canManageBilling = role === ADMIN_ROLE/);
});

test("clinical-note and delete controls are gated by permission in the CRM pages", () => {
  assert.match(readRoot("src/app/admin/citas/page.tsx"), /useCan\("appointments\.notes"\)/);
  assert.match(readRoot("src/app/admin/historial/[key]/page.tsx"), /useCan\("appointments\.notes"\)/);
  assert.match(readRoot("src/app/admin/whatsapp/page.tsx"), /useCan\("whatsapp\.chats\.delete"\)/);
});

// ── Batch A review fixes ─────────────────────────────────────────────────────

// Known risk (owner decision at the main merge, 2026-11-06): the booking keeps main's account lookup by email,
// so a typed email that belongs to an ADMIN or STAFF account owns the visit. Only the booking permission is checked.
test("booking for someone else requires the appointments.book permission", () => {
  assert.match(read("appointments/route.ts"), /can\(session\?\.user\?\.role, "appointments\.book"\)/);
});

test("appointment PATCH validates status first, lets only a CUSTOMER owner act without agenda rights, and hides reminder errors", () => {
  const src = read("appointments/[id]/route.ts");
  const statusCheck = src.indexOf('apiError("status_invalid", 400)');
  const reschedule = src.indexOf("await rescheduleAppointment(");
  assert.ok(statusCheck > 0 && statusCheck < reschedule, "status must be validated before the reschedule runs");
  assert.match(src, /isOwnerCustomer = role === "CUSTOMER" && appointment\.userId === userId/);
  assert.match(src, /omitClinicalNotes\(role, omitReminderError\(updated\)\)/);
});

// ── Batch C: patient history without clinical notes ─────────────────────────

const timeline = Object.freeze({
  patient: { patientKey: "5215512345678", name: "Ana" },
  visits: [{ id: "v1", reason: "motivo", note: { id: "n1", body: "clinica" } }, { id: "v2", reason: null, note: null }],
  orphanNotes: [{ id: "n2", body: "sin visita" }],
  pets: [],
});

test("omitPatientNotes: STAFF keeps visits and reasons, loses every note; input not mutated", () => {
  const safe = omitPatientNotes("STAFF", timeline);
  assert.deepEqual(safe.visits.map((v) => v.note), [null, null]);
  assert.deepEqual(safe.visits.map((v) => v.reason), ["motivo", null]);
  assert.deepEqual(safe.orphanNotes, []);
  assert.equal(timeline.visits[0].note?.body, "clinica");
  assert.equal(timeline.orphanNotes.length, 1);
});

test("omitPatientNotes keeps everything for ADMIN and fails closed for other roles", () => {
  assert.deepEqual(omitPatientNotes("ADMIN", timeline), timeline);
  assert.deepEqual(omitPatientNotes(undefined, timeline).orphanNotes, []);
});

test("omitNoteCounts: STAFF rows have no notes count; ADMIN rows keep it; input not mutated", () => {
  const rows = [Object.freeze({ patientKey: "1", visits: 3, notes: 2 })];
  assert.deepEqual(omitNoteCounts("STAFF", rows), [{ patientKey: "1", visits: 3 }]);
  assert.deepEqual(omitNoteCounts("ADMIN", rows), rows);
  assert.equal(rows[0].notes, 2);
});

test("the history list hides the notes column for roles that cannot read notes", () => {
  assert.match(readRoot("src/app/admin/historial/page.tsx"), /useCan\("appointments\.notes"\)/);
});
