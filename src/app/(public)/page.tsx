// src/app/(public)/page.tsx
import { prisma } from "@/lib/db";
import HeroCarousel from "@/components/shop/HeroCarousel";
import ProductCard from "@/components/shop/ProductCard";
import Link from "next/link";

async function getHomeData() {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: "clinica-demo" },
      include: {
        carouselImages: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        products: {
          where: { isActive: true, deletedAt: null },
          include: { reviews: { select: { rating: true } } },
          take: 4,
          orderBy: { createdAt: "desc" },
        },
      },
    });
    return tenant;
  } catch { return null; }
}

export default async function HomePage() {
  const tenant = await getHomeData();
  const products = tenant?.products.map(p => ({
    ...p,
    avgRating: p.reviews.length > 0 ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length : null,
    reviewCount: p.reviews.length,
  })) ?? [];

  return (
    <div>
      {/* Carrusel */}
      {tenant?.carouselImages && tenant.carouselImages.length > 0 && (
        <HeroCarousel images={tenant.carouselImages} />
      )}

      {/* Info del negocio */}
      {tenant?.businessInfo && (
        <section className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Bienvenidos a {tenant.name}</h2>
          <p className="text-gray-600 text-lg leading-relaxed">{tenant.businessInfo}</p>
        </section>
      )}

      {/* Productos destacados */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Nuestros productos y servicios</h2>
          <Link href="/productos" className="text-primary font-medium hover:underline">Ver todos →</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
