// src/app/api/products/categories/route.ts
// GET: distinct categories of the tenant's active products, for the category autocomplete (admin only).
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Never cached: a category saved a moment ago must show up at once.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  const rows = await prisma.product.findMany({
    where: { tenantId, deletedAt: null, category: { not: null } },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });

  return Response.json({
    categories: rows.map((r) => r.category).filter((c): c is string => !!c && c.trim() !== ""),
  });
}
