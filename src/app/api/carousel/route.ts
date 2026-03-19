// src/app/api/carousel/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  // For admin panel: use session tenantId (most reliable)
  // For public storefront: parse tenant from host header
  const session = await getServerSession(authOptions);
  let tenantId: string | null = (session?.user as any)?.tenantId ?? null;

  if (!tenantId) {
    // Public access — resolve from host
    const host = req.headers.get("host") || "";
    let tenantSlug = "clinica-demo";
    if (host.includes(".localhost")) tenantSlug = host.split(".")[0];
    else if (!host.includes("localhost")) tenantSlug = host.split(":")[0];

    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] },
    });
    if (!tenant) return Response.json([]);
    tenantId = tenant.id;
  }

  const images = await prisma.carouselImage.findMany({
    where: { tenantId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return Response.json(images);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  const { url, alt } = await req.json();
  const count = await prisma.carouselImage.count({ where: { tenantId } });
  const image = await prisma.carouselImage.create({ data: { tenantId, url, alt, sortOrder: count } });
  return Response.json(image, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  // Reordenar: recibe array de { id, sortOrder }
  const { order } = await req.json();
  await Promise.all(
    (order as { id: string; sortOrder: number }[]).map((item) =>
      prisma.carouselImage.update({ where: { id: item.id, tenantId }, data: { sortOrder: item.sortOrder } })
    )
  );
  return Response.json({ ok: true });
}
