// Tests for the plan guards: the lock rule per plan, and that every guarded page and API calls its guard.
// Run: npx tsx --test local-utils/plan-guard.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isPlanLockedFor, type CapabilityContext, type CapabilityPlan } from "../src/lib/capabilities";

function ctx(plan: CapabilityPlan, overrides: Partial<CapabilityContext> = {}): CapabilityContext {
  return {
    vertical: "HEALTH",
    plan,
    isBookingEnabled: true,
    isAssistantEnabled: true,
    isTriageEnabled: true,
    connectedApps: ["FACEBOOK", "WHATSAPP"],
    enabledTools: ["history", "patients"],
    ...overrides,
  };
}

// Pro tools: locked below Pro, open on Pro.
for (const id of ["history", "patients", "social-campaign"]) {
  test(`${id} is locked for START and PLUS, open for PRO`, () => {
    assert.equal(isPlanLockedFor(id, ctx("START")), true);
    assert.equal(isPlanLockedFor(id, ctx("PLUS")), true);
    assert.equal(isPlanLockedFor(id, ctx("PRO")), false);
  });
}

test("a lock is not reported when the tool is off for the business anyway", () => {
  assert.equal(isPlanLockedFor("patients", ctx("START", { isTriageEnabled: false })), false);
  assert.equal(isPlanLockedFor("history", ctx("START", { isBookingEnabled: false })), false);
  assert.equal(isPlanLockedFor("social-campaign", ctx("START", { connectedApps: ["WHATSAPP"] })), false);
});

test("a lock is not reported for a vertical that never gets the tool", () => {
  // Patients needs isTriage, so a store with triage off gets no lock.
  assert.equal(isPlanLockedFor("patients", ctx("START", { vertical: "ECOMMERCE", isTriageEnabled: false })), false);
});

test("an unknown tool id throws instead of silently passing", () => {
  assert.throws(() => isPlanLockedFor("does-not-exist", ctx("START")), /Unknown capability/);
});

// Wiring: each guarded page and API must call its guard with the right id. A missing call is a silent hole.
const GUARDS: { file: string; pattern: RegExp }[] = [
  { file: "src/app/admin/historial/layout.tsx", pattern: /redirectIfPlanLocked\(session\.user\.tenantId, "history"\)/ },
  { file: "src/app/admin/pacientes/layout.tsx", pattern: /redirectIfPlanLocked\(session\.user\.tenantId, "patients"\)/ },
  { file: "src/app/admin/social-campaign/layout.tsx", pattern: /redirectIfPlanLocked\(session\.user\.tenantId, "social-campaign"\)/ },
  { file: "src/app/api/admin/historial/route.ts", pattern: /planLockResponse\(tenantId, "history"\)/ },
  { file: "src/app/api/admin/historial/[key]/route.ts", pattern: /planLockResponse\(tenantId, "history"\)/ },
  { file: "src/app/api/admin/pacientes/route.ts", pattern: /planLockResponse\(tenantId, "patients"\)/ },
  { file: "src/app/api/campaigns/social/route.ts", pattern: /planLockResponse\(tenantId, "social-campaign"\)[\s\S]*planLockResponse\(tenantId, "social-campaign"\)/ },
  { file: "src/app/api/campaigns/social/history/route.ts", pattern: /planLockResponse\(tenantId, "social-campaign"\)/ },
  { file: "src/app/api/campaigns/social/[id]/route.ts", pattern: /planLockResponse\(tenantId, "social-campaign"\)[\s\S]*planLockResponse\(tenantId, "social-campaign"\)/ },
  { file: "src/app/api/apps/whatsapp/confirmations/route.ts", pattern: /planLockResponse\(tenantId, "confirmations"\)/ },
  { file: "src/app/api/apps/whatsapp/confirmations/[id]/route.ts", pattern: /planLockResponse\(tenantId, "confirmations"\)/ },
  { file: "src/app/api/campaigns/social/due/route.ts", pattern: /isPlanLocked\(CAPABILITIES\.find\(\(x\) => x\.id === "social-campaign"\)!, ctx\)/ },
];

for (const guard of GUARDS) {
  test(`${guard.file} calls its plan guard`, () => {
    const source = readFileSync(path.join(process.cwd(), guard.file), "utf8");
    assert.match(source, guard.pattern);
  });
}

test("the internal n8n path of the social campaign PATCH is not plan-checked", () => {
  const source = readFileSync(path.join(process.cwd(), "src/app/api/campaigns/social/[id]/route.ts"), "utf8");
  // The guard runs only when a session tenant exists, so the internal-secret path (no session) keeps working.
  assert.match(source, /if \(tenantId\) \{\s*const denied = await planLockResponse\(tenantId, "social-campaign"\);/);
});

// Owner activation (Tenant.enabledTools): a Pro tool the owner has not turned on is available, not locked.
import { toolStatus, CAPABILITIES as ALL_CAPS } from "../src/lib/capabilities";

test("a Pro tool the plan includes but the owner has not activated is 'available', not locked", () => {
  const history = ALL_CAPS.find((c) => c.id === "history")!;
  const pro = ctx("PRO", { enabledTools: [] });
  assert.equal(toolStatus(history, pro), "available");
  assert.equal(isPlanLockedFor("history", pro), false);
});

test("once activated the tool is 'active'; below Pro it stays 'locked' even if listed", () => {
  const history = ALL_CAPS.find((c) => c.id === "history")!;
  assert.equal(toolStatus(history, ctx("PRO", { enabledTools: ["history"] })), "active");
  assert.equal(toolStatus(history, ctx("START", { enabledTools: ["history"] })), "locked");
});

test("a tool with no activation step is active as soon as the plan includes it", () => {
  const social = ALL_CAPS.find((c) => c.id === "social-campaign")!;
  assert.equal(toolStatus(social, ctx("PRO", { enabledTools: [] })), "active");
});
