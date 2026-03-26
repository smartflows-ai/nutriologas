// src/app/(public)/productos/page.tsx
import { prisma } from "@/lib/db";
import ProductCard from "@/components/shop/ProductCard";
import { getTenantSlug } from "@/lib/tenant";

async function getProducts(category?: string) {
  const tenantSlug = getTenantSlug();

  const tenant = await prisma.tenant.findFirst({ 
    where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] } 
  });
  if (!tenant) return { products: [], categories: [] };

  const products = await prisma.product.findMany({
    where: { tenantId: tenant.id, isActive: true, deletedAt: null, ...(category && { category }) },
    include: { reviews: { select: { rating: true } } },
    orderBy: { createdAt: "desc" },
  });

  const categories = await prisma.product.findMany({
    where: { tenantId: tenant.id, isActive: true, deletedAt: null, category: { not: null } },
    select: { category: true },
    distinct: ["category"],
  });

  return {
    products: products.map((p) => ({
      ...p,
      avgRating: p.reviews.length > 0 ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length : null,
      reviewCount: p.reviews.length,
    })),
    categories: categories.map((c) => c.category!).filter(Boolean),
  };
}

export default async function ProductosPage({ searchParams }: { searchParams: { category?: string } }) {
  const { products, categories } = await getProducts(searchParams.category);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Productos y servicios</h1>
      <p className="text-gray-500 mb-8">Encuentra el plan o producto ideal para tu salud</p>

      {/* Filtros de categoría */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <a href="/productos" className={`badge px-4 py-2 rounded-full border text-sm font-medium transition-colors ${!searchParams.category ? "bg-primary text-white border-primary" : "border-gray-300 text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary"}`}>
            Todos
          </a>
          {categories.map((cat) => (
            <a key={cat} href={`/productos?category=${cat}`} className={`badge px-4 py-2 rounded-full border text-sm font-medium transition-colors ${searchParams.category === cat ? "bg-primary text-white border-primary" : "border-gray-300 text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary"}`}>
              {cat}
            </a>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No hay productos disponibles.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      )}
    </div>
  );
}
