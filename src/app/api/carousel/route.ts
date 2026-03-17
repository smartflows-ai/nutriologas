// src/app/api/carousel/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("tenant") ?? "clinica-demo";
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return Response.json([]);
  const images = await prisma.carouselImage.findMany({
    where: { tenantId: tenant.id, isActive: true },
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
