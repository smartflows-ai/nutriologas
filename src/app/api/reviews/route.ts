// src/app/api/reviews/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reviewSchema } from "@/lib/validations";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  const tenantSlug = searchParams.get("tenant") ?? "clinica-demo";
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return Response.json([]);
  const reviews = await prisma.review.findMany({
    where: { tenantId: tenant.id, isVisible: true, ...(productId && { productId }) },
    include: { user: { select: { name: true, image: true } } },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(reviews);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: "Debes iniciar sesión" }, { status: 401 });
  const userId = session.user.id!;
  const tenantId = (session.user as any).tenantId;
  const body = await req.json();
  const { productId, ...data } = body;
  const parsed = reviewSchema.parse(data);
  // Verificar que el usuario compró el producto
  const purchased = await prisma.orderItem.findFirst({
    where: { productId, order: { userId, tenantId, status: "PAID" } },
  });
  if (!purchased) return Response.json({ error: "Solo puedes dejar review de productos que hayas comprado" }, { status: 403 });
  const review = await prisma.review.create({ data: { ...parsed, productId, userId, tenantId } });
  return Response.json(review, { status: 201 });
}
