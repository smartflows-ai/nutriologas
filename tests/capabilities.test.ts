// Tests for src/lib/capabilities.ts (Phase 1: the registry must match what the sidebar showed before).
// Run: npx tsx --test local-utils/capabilities.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAPABILITIES,
  isCapabilityVisible,
  isPlanLocked,
  isPlanLockedInCatalog,
  planLockedCapabilities,
  toCapabilityPlan,
  visibleCapabilities,
  type Capability,
  type CapabilityContext,
} from "../src/lib/capabilities";

const VERTICALS = ["ECOMMERCE", "GENERAL", "HEALTH", "VETERINARY", "PET_CARE", "TOURISM", "TRAVEL", "SERVICES"];

function ctx(overrides: Partial<CapabilityContext> = {}): CapabilityContext {
  return {
    vertical: "ECOMMERCE",
    plan: "START",
    isBookingEnabled: true,
    isAssistantEnabled: true,
    isTriageEnabled: true,
    connectedApps: ["WHATSAPP", "FACEBOOK"],
    enabledTools: ["history", "patients"],
    ...overrides,
  };
}

// The filter AdminSidebar.tsx applied before the registry existed (copied for parity).
function legacySidebarVisible(c: CapabilityContext): string[] {
  const legacyCapabilities = CAPABILITIES.map((cap) => ({ id: cap.id, gates: cap.gates, verticals: cap.verticals }));
  return legacyCapabilities
    .filter((item) => {
      if (item.gates.isAssistant && !c.isAssistantEnabled) return false;
      if (item.gates.isTriage && !c.isTriageEnabled) return false;
      if (item.gates.isBooking && !c.isBookingEnabled) return false;
      if (item.gates.isOrders && !(c.vertical === "ECOMMERCE" || c.vertical === "GENERAL" || !["HEALTH", "VETERINARY", "TOURISM", "TRAVEL", "SERVICES", "PET_CARE"].includes(c.vertical))) return false;
      if (item.gates.providersReq && !item.gates.providersReq.some((p) => c.connectedApps.includes(p))) return false;
      return true;
    })
    .map((item) => item.id);
}

test("registry has unique ids and routes under /admin", () => {
  const ids = CAPABILITIES.map((c) => c.id);
  // Routes may repeat: confirmations is a tab inside /admin/whatsapp, next to the WhatsApp tool itself.
  const routes = CAPABILITIES.map((c) => c.route);
  assert.equal(new Set(ids).size, ids.length);
  for (const route of routes) assert.ok(route.startsWith("/admin/"), route);
});

test("only the approved tools are plan-gated; everything else stays at START", () => {
  const gated = Object.fromEntries(CAPABILITIES.filter((c) => c.enforcedPlan !== "START").map((c) => [c.id, c.enforcedPlan]));
  assert.deepEqual(gated, { history: "PRO", patients: "PRO", confirmations: "PLUS", "social-campaign": "PRO" });
});

test("maps Subscription.plan values to registry plans", () => {
  assert.equal(toCapabilityPlan("STARTER"), "START");
  assert.equal(toCapabilityPlan("PLUS"), "PLUS");
  assert.equal(toCapabilityPlan("PRO"), "PRO");
  assert.equal(toCapabilityPlan("ENTERPRISE"), "PRO");
  assert.equal(toCapabilityPlan(null), "START");
  assert.equal(toCapabilityPlan("SOMETHING_NEW"), "START");
});

test("a STARTER tenant sees Patients and Social Campaigns locked, and Patient history locked too", () => {
  const start = ctx({ plan: "START", vertical: "HEALTH" });
  const locked = planLockedCapabilities(start).map((c) => c.id);
  assert.ok(locked.includes("history"));
  assert.ok(locked.includes("patients"));
  assert.ok(locked.includes("social-campaign"));
  const visible = visibleCapabilities(start).map((c) => c.id);
  assert.ok(!visible.includes("history"));
  assert.ok(!visible.includes("patients"));
});

test("a PLUS tenant sees neither patient history nor patients (both are Pro)", () => {
  const plus = ctx({ plan: "PLUS", vertical: "HEALTH" });
  const visible = visibleCapabilities(plus).map((c) => c.id);
  assert.ok(!visible.includes("history"));
  assert.ok(!visible.includes("patients"));
  assert.ok(planLockedCapabilities(plus).some((c) => c.id === "history"));
  assert.ok(planLockedCapabilities(plus).some((c) => c.id === "patients"));
});

test("the App Store lock applies even when the integration is not connected", () => {
  const social = CAPABILITIES.find((c) => c.id === "social-campaign") as Capability;
  const notConnected = ctx({ plan: "PLUS", connectedApps: ["WHATSAPP"] });
  assert.equal(isPlanLocked(social, notConnected), false); // the sidebar hides it: no connection
  assert.equal(isPlanLockedInCatalog(social, notConnected), true); // the App Store shows the legend
  assert.equal(isPlanLockedInCatalog(social, ctx({ plan: "PRO", connectedApps: [] })), false);
});

test("a plan-locked tool is not locked when its flags or vertical hide it anyway", () => {
  const store = ctx({ plan: "START", vertical: "ECOMMERCE", isTriageEnabled: false });
  assert.ok(!planLockedCapabilities(store).some((c) => c.id === "patients"));
});

test("visible set matches the old sidebar filter for every vertical and flag combination", () => {
  const flags = [true, false];
  for (const vertical of VERTICALS) {
    for (const isBookingEnabled of flags) {
      for (const isAssistantEnabled of flags) {
        for (const isTriageEnabled of flags) {
          for (const connectedApps of [[], ["WHATSAPP"], ["FACEBOOK"], ["WHATSAPP", "FACEBOOK"]]) {
            // At PRO nothing is plan-locked, so the visible set must equal the old sidebar filter.
            const c = ctx({ vertical, isBookingEnabled, isAssistantEnabled, isTriageEnabled, connectedApps, plan: "PRO" });
            const got = visibleCapabilities(c).map((x) => x.id);
            assert.deepEqual(got, legacySidebarVisible(c), JSON.stringify(c));
          }
        }
      }
    }
  }
});

test("a store with booking off hides history and appointments; a service vertical has no orders", () => {
  const store = visibleCapabilities(ctx({ vertical: "ECOMMERCE", isBookingEnabled: false, plan: "PRO" })).map((c) => c.id);
  assert.ok(!store.includes("history"));
  assert.ok(!store.includes("appointments"));
  assert.ok(store.includes("orders"));

  const health = visibleCapabilities(ctx({ vertical: "HEALTH", plan: "PRO" })).map((c) => c.id);
  assert.ok(health.includes("patients"));
  assert.ok(!health.includes("orders"));
});

test("a tool is hidden when its connected app is missing", () => {
  const social = CAPABILITIES.find((c) => c.id === "social-campaign") as Capability;
  assert.equal(isCapabilityVisible(social, ctx({ plan: "PRO", connectedApps: ["WHATSAPP"] })), false);
  assert.equal(isCapabilityVisible(social, ctx({ plan: "PRO", connectedApps: ["FACEBOOK"] })), true);
});

test("a tool whose enforced plan is above the tenant plan is hidden", () => {
  const pro: Capability = { id: "x", section: "general", route: "/admin/x", ai: false, verticals: "all", enforcedPlan: "PRO", targetPlan: "PRO", gates: {} };
  assert.equal(isCapabilityVisible(pro, ctx({ plan: "START" })), false);
  assert.equal(isCapabilityVisible(pro, ctx({ plan: "PLUS" })), false);
  assert.equal(isCapabilityVisible(pro, ctx({ plan: "PRO" })), true);
});

test("a tool limited to some verticals is hidden in the others", () => {
  const healthOnly: Capability = { id: "y", section: "general", route: "/admin/y", ai: false, verticals: ["HEALTH"], enforcedPlan: "START", targetPlan: "START", gates: {} };
  assert.equal(isCapabilityVisible(healthOnly, ctx({ vertical: "HEALTH" })), true);
  assert.equal(isCapabilityVisible(healthOnly, ctx({ vertical: "ECOMMERCE" })), false);
});
