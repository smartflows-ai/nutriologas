import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { productSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";
import { NextRequest } from "next/server";
import { resolveTenantSlug } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;

  const session = await getServerSession(authOptions);
  let tenantId: string | null = (session?.user as any)?.tenantId ?? null;

  if (!tenantId) {
    const host = req.headers.get("host") || "";
    const tenantSlug = resolveTenantSlug(host);

    const tenant = await prisma.tenant.findFirst({ 
      where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] } 
    });
    if (!tenant) return Response.json({ error: "Tenant no encontrado" }, { status: 404 });
    tenantId = tenant.id;
  }

  const isAdmin = session?.user && (session.user as any).role === "ADMIN";
  const where = { tenantId, deletedAt: null, ...(!isAdmin && { isActive: true }), ...(category && { category }) };

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { reviews: { select: { rating: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.product.count({ where })
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return Response.json({
    products: products.map(p => ({
      ...p,
      avgRating: p.reviews.length > 0 ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length : null,
      reviewCount: p.reviews.length,
    })),
    totalCount,
    totalPages,
    currentPage: page,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 401 });

  const tenantId = (session.user as any).tenantId;
  const body = await req.json();
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "validation_failed" }, { status: 400 });
  const data = parsed.data;

  // Deleted products keep their row (soft delete) and their slug, so a slug can be taken by a deleted item.
  const baseSlug = slugify(data.name);
  const taken = await prisma.product.findUnique({
    where: { tenantId_slug: { tenantId, slug: baseSlug } },
    select: { id: true },
  });
  const slug = taken ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

  const product = await prisma.product.create({
    data: {
      ...data,
      tenantId,
      slug,
      serviceConfig: data.serviceConfig ?? undefined,
    } as any,
  });

  return Response.json(product, { status: 201 });
}
