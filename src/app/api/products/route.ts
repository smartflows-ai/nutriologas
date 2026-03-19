// src/app/api/products/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { productSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category");

  // For admin panel: use session tenantId (most reliable)
  // For public storefront: parse tenant from host header
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
    if (!tenant) return Response.json({ error: "Tenant no encontrado" }, { status: 404 });
    tenantId = tenant.id;
  }

  const products = await prisma.product.findMany({
    where: { tenantId, isActive: true, deletedAt: null, ...(category && { category }) },
    include: { reviews: { select: { rating: true } } },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(products.map(p => ({
    ...p,
    avgRating: p.reviews.length > 0 ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length : null,
    reviewCount: p.reviews.length,
  })));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 401 });

  const tenantId = (session.user as any).tenantId;
  const body = await req.json();
  const data = productSchema.parse(body);

  const slug = slugify(data.name);
  const product = await prisma.product.create({
    data: { ...data, tenantId, slug },
  });

  return Response.json(product, { status: 201 });
}
