// src/app/api/internal/tenant-context/route.ts
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  // Verificar clave interna
  const key = req.headers.get("x-internal-key");
  if (key !== process.env.INTERNAL_API_KEY)
    return Response.json({ error: "No autorizado" }, { status: 401 });

  const { slug: rawSlug } = await req.json();

  let searchCondition: any = { slug: rawSlug };
  if (rawSlug && typeof rawSlug === 'string' && rawSlug.length > 36) {
    const maybeUuid = rawSlug.slice(-36);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(maybeUuid)) {
      searchCondition = { id: maybeUuid };
    }
  }

  const tenant = await prisma.tenant.findFirst({
    where: searchCondition,
    include: {
      products: {
        where: { isActive: true, deletedAt: null },
        select: { name: true, price: true, description: true, category: true },
      },
      theme: true,
      connectedApps: {
        where: { provider: "WHATSAPP" },
        select: { waInstanceId: true, waStatus: true, waPhoneNumber: true, waTemperature: true, waContext: true },
      },
    },
  });

  if (!tenant)
    return Response.json({ error: "Tenant no encontrado" }, { status: 404 });

  const waApp = tenant.connectedApps[0];

  return Response.json({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    businessInfo: tenant.businessInfo,
    whatsappNumber: tenant.whatsappNumber,
    evolutionInstance: waApp?.waInstanceId ?? null,
    waTemperature: waApp?.waTemperature ?? 0.7,
    waContext: waApp?.waContext ?? null,
    products: tenant.products.map(p => ({
      name: p.name,
      price: `$${p.price} MXN`,
      description: p.description,
      category: p.category,
    })),
  });
}
