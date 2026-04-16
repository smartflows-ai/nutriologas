// src/app/(public)/productos/page.tsx
import { prisma } from "@/lib/db";
import ProductCard from "@/components/shop/ProductCard";
import ProductSort from "@/components/shop/ProductSort";
import { getTenantSlug } from "@/lib/tenant";
import Link from "next/link";
import { Search, SlidersHorizontal, PackageX, ChevronRight, Home } from "lucide-react";

async function getProducts(category?: string, sort?: string) {
  const tenantSlug = getTenantSlug();

  const tenant = await prisma.tenant.findFirst({ 
    where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] } 
  });
  if (!tenant) return { products: [], categories: [], tenantName: "Tienda" };

  let orderBy: any = { createdAt: "desc" };
  if (sort === "price_asc") orderBy = { price: "asc" };
  if (sort === "price_desc") orderBy = { price: "desc" };

  const products = await prisma.product.findMany({
    where: { tenantId: tenant.id, isActive: true, deletedAt: null, ...(category && { category }) },
    include: { reviews: { select: { rating: true } } },
    orderBy,
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
    tenantName: tenant.name,
  };
}

export default async function ProductosPage({ searchParams }: { searchParams: { category?: string; sort?: string } }) {
  const { products, categories, tenantName } = await getProducts(searchParams.category, searchParams.sort);
  const activeCategory = searchParams.category || null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07070f]">
      {/* ── Premium E-Commerce Header ───────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 pt-24 pb-12 sm:pt-32 sm:pb-16 shadow-sm">
        {/* Soft background glow based on DB Theme variable */}
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-[var(--color-primary)]/15 to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-start">
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6 font-medium">
            <Link href="/" className="hover:text-[var(--color-primary)] transition-colors flex items-center gap-1.5"><Home size={14}/> Inicio</Link>
            <ChevronRight size={14} className="text-gray-400" />
            <span className="text-gray-900 dark:text-white font-semibold">Productos</span>
            {activeCategory && (
              <>
                <ChevronRight size={14} className="text-gray-400" />
                <span className="text-[var(--color-primary)] font-semibold">{activeCategory}</span>
              </>
            )}
          </nav>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 dark:text-white tracking-tight leading-[1.1] mb-4">
            {activeCategory ? activeCategory : "Todos los Productos"}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
            Explora nuestro catálogo completo de servicios y productos diseñados especialmente para potenciar tu experiencia con <span className="font-bold text-[var(--color-primary)]">{tenantName}</span>.
          </p>
        </div>
      </div>

      {/* ── Main Storefront Layout ────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
        <div className="flex flex-col lg:flex-row gap-10">
          
          {/* ── SIDEBAR (Left Column) ────────────────────────────────────────── */}
          {categories.length > 0 && (
            <aside className="lg:w-64 shrink-0">
              <div className="sticky top-28 bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6 relative">
                  <div className="bg-[var(--color-primary)]/10 p-2 rounded-lg text-[var(--color-primary)]">
                    <SlidersHorizontal size={18} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Categorías</h2>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <Link 
                    href="/productos" 
                    className={`block px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${!activeCategory ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20 translate-x-1" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-[var(--color-primary)]"}`}
                  >
                    Todos los departamentos
                  </Link>
                  {categories.map((cat) => (
                    <Link 
                      key={cat} 
                      href={`/productos?category=${encodeURIComponent(cat)}`} 
                      className={`block px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeCategory === cat ? "bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20 translate-x-1" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-[var(--color-primary)]"}`}
                    >
                      {cat}
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          )}

          {/* ── PRODUCT GRID (Right Column) ─────────────────────────────────── */}
          <section className="flex-1 min-w-0">
            {/* Meta Utility Bar */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200/50 dark:border-gray-800/50">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Mostrando <span className="font-bold text-gray-900 dark:text-white">{products.length}</span> {products.length === 1 ? 'resultado' : 'resultados'}
              </p>
              
              <ProductSort />
            </div>

            {/* Grid */}
            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 lg:py-32 bg-white dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-800 rounded-[2rem] text-center px-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-full mb-6">
                  <PackageX size={48} className="text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">No encontramos productos</h3>
                <p className="text-gray-500 max-w-sm mb-6 font-medium">
                  Intenta buscar en otra categoría o vuelve más tarde para ver nuestras novedades.
                </p>
                <a href="/productos" className="bg-[var(--color-primary)] text-white hover:brightness-110 px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-[var(--color-primary)]/20 transition-all active:scale-95">
                  Ver todo el catálogo
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
