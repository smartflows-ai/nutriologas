// src/app/api/reviews/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reviewSchema } from "@/lib/validations";
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;

  // Session-first (admin), then host-based for public visitors
  const session = await getServerSession(authOptions);
  let tenantId: string | null = (session?.user as any)?.tenantId ?? null;

  if (!tenantId) {
    const host = req.headers.get("host") || "";
    let tenantSlug = "clinica-demo";
    if (host.includes(".localhost")) tenantSlug = host.split(".")[0];
    else if (!host.includes("localhost")) tenantSlug = host.split(":")[0];
    const tenant = await prisma.tenant.findFirst({ 
      where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] } 
    });
    if (!tenant) return Response.json([]);
    tenantId = tenant.id;
  }
  // Admins see all reviews; public visitors only see visible ones
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const rating = searchParams.get("rating");

  const where = {
    tenantId,
    ...(isAdmin ? {} : { isVisible: true }),
    ...(productId && { productId }),
    ...(rating && rating !== "all" ? { rating: parseInt(rating) } : {}),
  };

  const [reviews, totalCount] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        user: { select: { name: true, image: true } },
        product: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.review.count({ where })
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return Response.json({
    reviews,
    totalCount,
    totalPages,
    currentPage: page,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: "Debes iniciar sesión" }, { status: 401 });
  const userId = session.user.id!;
  const tenantId = (session.user as any).tenantId;
  const body = await req.json();
  const { productId, ...data } = body;
  const parsed = reviewSchema.parse(data);

  // Verificar que el producto pertenece al tenant
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
  });
  if (!product) return Response.json({ error: "Producto no encontrado" }, { status: 404 });

  // Verificar que el usuario no haya dejado ya una reseña para este producto
  const existing = await prisma.review.findFirst({
    where: { productId, userId, tenantId },
  });
  if (existing) return Response.json({ error: "Ya dejaste una reseña para este producto" }, { status: 409 });

  const review = await prisma.review.create({ data: { ...parsed, productId, userId, tenantId } });

  // Revalidate the product page to update SSR content (avg rating, etc.)
  revalidatePath(`/producto/${product.slug}`);

  return Response.json(review, { status: 201 });
}
