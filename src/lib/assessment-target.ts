// src/lib/assessment-target.ts
// Database side of "the service to book to learn the price": loads the pointed service and applies the pure rule
// (src/lib/price-display.ts). Always filtered by tenantId.
import { prisma } from "@/lib/db";
import { resolveAssessmentTarget } from "@/lib/price-display";

const CANDIDATE_SELECT = {
  id: true, tenantId: true, name: true, slug: true, isActive: true, deletedAt: true,
  requiresBooking: true, price: true, priceMode: true,
} as const;

/** True when `targetId` may be saved as the assessment service of the product `ownerId` (null for a new product). */
export async function isValidAssessmentTarget(tenantId: string, ownerId: string | null, targetId: string): Promise<boolean> {
  const [tenant, candidate] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { isBookingEnabled: true } }),
    prisma.product.findFirst({ where: { id: targetId, tenantId }, select: CANDIDATE_SELECT }),
  ]);
  if (!tenant) return false;
  const owner = { id: ownerId ?? "new", tenantId, priceMode: "ON_REQUEST" as const, assessmentProductId: targetId };
  return resolveAssessmentTarget(owner, candidate, tenant) !== null;
}

/**
 * For each "on request" product that points to a service, the service to book instead (null when the pointer is
 * missing or no longer valid). One query for all the targets, so a catalog page does not run one per product.
 */
export async function loadAssessmentTargets(
  tenant: { id: string; isBookingEnabled: boolean },
  products: ReadonlyArray<{ id: string; tenantId: string; priceMode?: "FIXED" | "FROM" | "ON_REQUEST" | null; assessmentProductId?: string | null }>
): Promise<Map<string, { id: string; name: string; slug: string }>> {
  const ids = Array.from(new Set(products.map((p) => p.assessmentProductId).filter((id): id is string => !!id)));
  const result = new Map<string, { id: string; name: string; slug: string }>();
  if (ids.length === 0) return result;
  const candidates = await prisma.product.findMany({ where: { id: { in: ids }, tenantId: tenant.id }, select: CANDIDATE_SELECT });
  const byId = new Map(candidates.map((c) => [c.id, c]));
  for (const p of products) {
    const target = resolveAssessmentTarget(p, p.assessmentProductId ? byId.get(p.assessmentProductId) ?? null : null, tenant);
    if (target) result.set(p.id, target);
  }
  return result;
}
