// src/lib/capability-guard.ts
// Server-side checks for CRM pages and APIs. Sidebar hiding is not security: these guards are.
// Plan locks go to billing; a tool the plan includes but the owner has not activated goes to the App Store.
// Other gates (flags, vertical, connected apps) keep their current behavior.
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isNotActivated,
  isPlanLockedFor,
  toCapabilityPlan,
  CAPABILITIES,
  type CapabilityContext,
} from "@/lib/capabilities";

export async function capabilityContextForTenant(tenantId: string): Promise<CapabilityContext | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: true, connectedApps: true },
  });
  if (!tenant) return null;
  return {
    vertical: tenant.vertical ?? "ECOMMERCE",
    plan: toCapabilityPlan(tenant.subscription?.plan),
    isBookingEnabled: tenant.isBookingEnabled ?? true,
    isAssistantEnabled: tenant.isAssistantEnabled ?? false,
    isTriageEnabled: tenant.isTriageEnabled ?? false,
    connectedApps: tenant.connectedApps.map((a) => a.provider),
    enabledTools: tenant.enabledTools,
  };
}

function capabilityById(capabilityId: string) {
  const capability = CAPABILITIES.find((c) => c.id === capabilityId);
  if (!capability) throw new Error(`Unknown capability: ${capabilityId}`);
  return capability;
}

// For API handlers: 403 when the plan is too low (plan_required) or the owner has not activated the tool (tool_not_enabled).
export async function planLockResponse(tenantId: string, capabilityId: string): Promise<NextResponse | null> {
  const ctx = await capabilityContextForTenant(tenantId);
  if (!ctx) return null;
  if (isPlanLockedFor(capabilityId, ctx)) {
    return NextResponse.json({ error: "plan_required", capability: capabilityId }, { status: 403 });
  }
  if (isNotActivated(capabilityById(capabilityId), ctx)) {
    return NextResponse.json({ error: "tool_not_enabled", capability: capabilityId }, { status: 403 });
  }
  return null;
}

// For pages: plan too low goes to billing; not activated goes to the App Store, where the owner turns it on.
export async function redirectIfPlanLocked(tenantId: string, capabilityId: string): Promise<void> {
  const ctx = await capabilityContextForTenant(tenantId);
  if (!ctx) return;
  if (isPlanLockedFor(capabilityId, ctx)) redirect("/admin/suscripcion");
  if (isNotActivated(capabilityById(capabilityId), ctx)) redirect("/admin/apps");
}
