// src/app/api/internal/bot/context/route.ts
// POST: Tenant context for the WhatsApp agent, resolved from the Evolution instance name.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isInternalKeyValid, resolveBotTenant } from "@/lib/bot";
import { isBookable } from "@/lib/bookable";
import { getCreditStatus } from "@/lib/credits";

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { instance } = await req.json().catch(() => ({}));
  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });

  const [products, faqs, creditStatus] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId: bot.tenantId, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        price: true,
        description: true,
        category: true,
        durationMinutes: true,
        requiresBooking: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.fAQ.findMany({
      where: { tenantId: bot.tenantId, isActive: true },
      select: { question: true, answer: true },
      orderBy: { sortOrder: "asc" },
    }),
    getCreditStatus(bot.tenantId),
  ]);

  return Response.json({
    tenantId: bot.tenantId,
    tenantName: bot.tenantName,
    businessInfo: bot.businessInfo,
    waContext: bot.waContext,
    waTemperature: bot.waTemperature,
    businessHoursText: bot.businessHoursText,
    creditExhausted: creditStatus.isExhausted,
    // Read-only catalog: the agent may quote these prices but cannot change them.
    // bookable = sold by appointment; false means information only (no date, no booking tools).
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      currency: "MXN",
      description: p.description,
      category: p.category,
      durationMinutes: p.durationMinutes ?? 30,
      bookable: isBookable(p, bot),
    })),
    faqs,
  });
}
