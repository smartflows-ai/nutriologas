// src/lib/service-ref-data.ts
// The lookup behind the bot tools that name a service (bot/availability, bot/book), ticket #140. First the exact id
// over the whole catalog of the business, with no limit, exactly as before: a store with thousands of products still
// finds any of them by its id. Only when that finds nothing, the tolerant search (a unique 8-character prefix or a
// unique exact name, see service-ref.ts) over the first TOLERANT_SEARCH_LIMIT active services by name. A catalog larger
// than that limit is not searched by prefix or name beyond it; the agent then gets the list of rescue options.
// Every query is limited to the active services of the business (tenantId, isActive, deletedAt).
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isBookable } from "@/lib/bookable";
import type { BotTenant } from "@/lib/bot";
import { resolveServiceRef, type ServiceRefResult } from "@/lib/service-ref";

/** Services read by the tolerant search; the exact-id search is not limited. */
export const TOLERANT_SEARCH_LIMIT = 200;

const SERVICE_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  durationMinutes: true,
  requiresBooking: true,
  visitModes: true,
  priceMode: true,
  assessmentProductId: true,
} satisfies Prisma.ProductSelect;

export type BotService = Prisma.ProductGetPayload<{ select: typeof SERVICE_SELECT }>;

export async function findServiceForBot(
  bot: Pick<BotTenant, "tenantId" | "isBookingEnabled">,
  input: { productId?: unknown; serviceName?: unknown },
): Promise<ServiceRefResult<BotService>> {
  // 1. The exact id, over the whole catalog, as before.
  if (typeof input.productId === "string" && input.productId.trim() !== "") {
    const exact = await prisma.product.findFirst({
      where: { id: input.productId, tenantId: bot.tenantId, isActive: true, deletedAt: null },
      select: SERVICE_SELECT,
    });
    if (exact) return { ok: true, service: exact, via: "id" };
  }

  // 2. Not found by id: the tolerant search.
  const services = await prisma.product.findMany({
    where: { tenantId: bot.tenantId, isActive: true, deletedAt: null },
    select: SERVICE_SELECT,
    orderBy: { name: "asc" },
    take: TOLERANT_SEARCH_LIMIT,
  });
  return resolveServiceRef(services, input, (service) => isBookable(service, bot));
}
