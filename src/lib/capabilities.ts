// src/lib/capabilities.ts
// Registry of the CRM tools: where each one lives, which verticals get it, which plan it belongs to,
// and what flags gate it today. Phase 1 (plan: capability map): this file describes the tools that
// already exist in the sidebar, and it does not change what any tenant sees.
// Plans are not enforced yet: every tool has enforcedPlan "START" until PLUS exists (Phase 2).
// targetPlan is the plan the product decision assigns (see the plan file, "Catalog").
// Patient history is Pro (decision D4: Pro = Plus + patient history).

export type CapabilityPlan = "START" | "PLUS" | "PRO";
export type CapabilitySection = "general" | "website" | "apps";

import { getVerticalProfile } from "./vertical-profile";

const PLAN_RANK: Record<CapabilityPlan, number> = { START: 1, PLUS: 2, PRO: 3 };

export interface CapabilityGates {
  isBooking?: boolean;
  isAssistant?: boolean;
  isTriage?: boolean;
  isOrders?: boolean;
  providersReq?: string[];
}

export interface Capability {
  id: string;
  section: CapabilitySection;
  route: string;
  ai: boolean;
  // "all" or the vertical names (BusinessVertical values) that get the tool.
  verticals: "all" | string[];
  enforcedPlan: CapabilityPlan;
  targetPlan: CapabilityPlan;
  gates: CapabilityGates;
  // The owner must turn it on in the App Store (stored in Tenant.enabledTools) after the plan includes it.
  activatable?: boolean;
}

export interface CapabilityContext {
  vertical: string;
  plan: CapabilityPlan;
  isBookingEnabled: boolean;
  isAssistantEnabled: boolean;
  isTriageEnabled: boolean;
  connectedApps: string[];
  enabledTools: string[];
}

export const CAPABILITIES: Capability[] = [
  { id: "dashboard", section: "general", route: "/admin/dashboard", ai: false, verticals: "all", enforcedPlan: "START", targetPlan: "START", gates: {} },
  { id: "history", section: "general", route: "/admin/historial", ai: false, verticals: "all", enforcedPlan: "PRO", targetPlan: "PRO", gates: { isBooking: true }, activatable: true },
  // Phase 1 keeps today's gates: patients only needs isTriage, orders only needs hasOrders. Narrowing them to HEALTH / stores is Phase 3.
  { id: "patients", section: "general", route: "/admin/pacientes", ai: false, verticals: "all", enforcedPlan: "PRO", targetPlan: "PRO", gates: { isTriage: true }, activatable: true },
  { id: "orders", section: "general", route: "/admin/pedidos", ai: false, verticals: "all", enforcedPlan: "START", targetPlan: "START", gates: { isOrders: true } },
  { id: "products", section: "general", route: "/admin/productos", ai: false, verticals: "all", enforcedPlan: "START", targetPlan: "START", gates: {} },
  { id: "reviews", section: "general", route: "/admin/reviews", ai: false, verticals: "all", enforcedPlan: "START", targetPlan: "START", gates: {} },
  { id: "business", section: "website", route: "/admin/negocio", ai: false, verticals: "all", enforcedPlan: "START", targetPlan: "START", gates: {} },
  // The owner's team: staff users (ticket #22). Every plan has the screen; the plan sets how many users fit
  // (src/lib/user-limits.ts). Only the owner opens it (src/lib/permissions.ts).
  { id: "team", section: "website", route: "/admin/equipo", ai: false, verticals: "all", enforcedPlan: "START", targetPlan: "START", gates: {} },
  { id: "carousel", section: "website", route: "/admin/carrusel", ai: false, verticals: "all", enforcedPlan: "START", targetPlan: "START", gates: {} },
  { id: "appearance", section: "website", route: "/admin/apariencia", ai: false, verticals: "all", enforcedPlan: "START", targetPlan: "START", gates: {} },
  { id: "faq", section: "website", route: "/admin/faq", ai: false, verticals: "all", enforcedPlan: "START", targetPlan: "START", gates: {} },
  { id: "apps", section: "apps", route: "/admin/apps", ai: false, verticals: "all", enforcedPlan: "START", targetPlan: "START", gates: {} },
  { id: "appointments", section: "apps", route: "/admin/citas", ai: false, verticals: "all", enforcedPlan: "START", targetPlan: "PLUS", gates: { isBooking: true } },
  { id: "assistant", section: "apps", route: "/admin/asistente", ai: true, verticals: "all", enforcedPlan: "START", targetPlan: "START", gates: { isAssistant: true } },
  { id: "whatsapp", section: "apps", route: "/admin/whatsapp", ai: true, verticals: "all", enforcedPlan: "START", targetPlan: "START", gates: { providersReq: ["WHATSAPP"] } },
  // Sub-feature of WhatsApp: the owner list of visits waiting for the customer's SI. Not a separate store card;
  // the App Store lists it as a line inside the WhatsApp card, and the tab and its APIs are the lock.
  { id: "confirmations", section: "apps", route: "/admin/whatsapp", ai: false, verticals: "all", enforcedPlan: "PLUS", targetPlan: "PLUS", gates: { isBooking: true, providersReq: ["WHATSAPP"] } },
  { id: "social-campaign", section: "apps", route: "/admin/social-campaign", ai: true, verticals: "all", enforcedPlan: "PRO", targetPlan: "PRO", gates: { providersReq: ["FACEBOOK"] } },
];

// The business has the tool: vertical, flags and connected apps allow it (plan and activation not checked).
export function isAvailable(capability: Capability, ctx: CapabilityContext): boolean {
  const { gates } = capability;
  if (capability.verticals !== "all" && !capability.verticals.includes(ctx.vertical)) return false;
  if (gates.isBooking && !ctx.isBookingEnabled) return false;
  if (gates.isAssistant && !ctx.isAssistantEnabled) return false;
  if (gates.isTriage && !ctx.isTriageEnabled) return false;
  if (gates.isOrders && !getVerticalProfile(ctx.vertical, ctx.isBookingEnabled).hasOrders) return false;
  if (gates.providersReq && !gates.providersReq.some((p) => ctx.connectedApps.includes(p))) return false;
  return true;
}

// The plan includes the tool.
export function isPlanIncluded(capability: Capability, ctx: CapabilityContext): boolean {
  return PLAN_RANK[ctx.plan] >= PLAN_RANK[capability.enforcedPlan];
}

// The owner turned it on (only for activatable tools; the rest need nothing).
export function isActivated(capability: Capability, ctx: CapabilityContext): boolean {
  return !capability.activatable || ctx.enabledTools.includes(capability.id);
}

// True when the tool is in the sidebar and its pages and APIs work: available, in the plan, and activated.
export function isCapabilityVisible(capability: Capability, ctx: CapabilityContext): boolean {
  return isAvailable(capability, ctx) && isPlanIncluded(capability, ctx) && isActivated(capability, ctx);
}

export function visibleCapabilities(ctx: CapabilityContext): Capability[] {
  return CAPABILITIES.filter((c) => isCapabilityVisible(c, ctx));
}

// The plan is too low for a tool the business has. Shown locked in the App Store, with an upgrade link.
export function isPlanLocked(capability: Capability, ctx: CapabilityContext): boolean {
  return isAvailable(capability, ctx) && !isPlanIncluded(capability, ctx);
}

// The plan includes it and the business has it, but the owner has not activated it yet.
export function isNotActivated(capability: Capability, ctx: CapabilityContext): boolean {
  return isAvailable(capability, ctx) && isPlanIncluded(capability, ctx) && !isActivated(capability, ctx);
}

// What the App Store shows for a tool: locked by plan, available to activate, or active.
export type ToolStatus = "locked" | "available" | "active" | "hidden";
export function toolStatus(capability: Capability, ctx: CapabilityContext): ToolStatus {
  if (!isAvailable(capability, ctx)) return "hidden";
  if (!isPlanIncluded(capability, ctx)) return "locked";
  if (!isActivated(capability, ctx)) return "available";
  return "active";
}

// Same rule as isPlanLocked, looked up by registry id. Used by the server guards (src/lib/capability-guard.ts).
export function isPlanLockedFor(capabilityId: string, ctx: CapabilityContext): boolean {
  const capability = CAPABILITIES.find((c) => c.id === capabilityId);
  if (!capability) throw new Error(`Unknown capability: ${capabilityId}`);
  return isPlanLocked(capability, ctx);
}

export function planLockedCapabilities(ctx: CapabilityContext): Capability[] {
  return CAPABILITIES.filter((c) => isPlanLocked(c, ctx));
}

// For the App Store, where a tool is shown even when it is not connected yet: the plan lock applies
// whether or not the integration exists (the connection requirement is ignored here).
export function isPlanLockedInCatalog(capability: Capability, ctx: CapabilityContext): boolean {
  return isPlanLocked({ ...capability, gates: { ...capability.gates, providersReq: undefined } }, ctx);
}

// Maps Subscription.plan (PlanId in the database) to the registry plan.
// Missing or unknown plans count as START; ENTERPRISE and the old vertical plans count as PRO.
export function toCapabilityPlan(subscriptionPlan: string | null | undefined): CapabilityPlan {
  switch (subscriptionPlan) {
    case "PLUS": return "PLUS";
    case "PRO":
    case "ENTERPRISE":
    case "CLINICA":
    case "VETERINARY":
    case "TOURISM": return "PRO";
    default: return "START";
  }
}
