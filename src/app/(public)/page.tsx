// src/app/(public)/page.tsx
import { prisma } from "@/lib/db";
import HeroCarousel from "@/components/shop/HeroCarousel";
import ProductCard from "@/components/shop/ProductCard";
import Link from "next/link";
import { getTenantSlug } from "@/lib/tenant";

async function getHomeData(): Promise<any> {
  const tenantSlug = getTenantSlug();
  console.log("[page.tsx] tenantSlug resolved:", tenantSlug);

  try {
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: tenantSlug },
          { customDomain: tenantSlug }
        ]
      },
      include: {
        carouselImages: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        products: {
          where: { isActive: true, deletedAt: null },
          include: { reviews: { select: { rating: true } } },
          take: 4,
          orderBy: { createdAt: "desc" },
        },
        faqs: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      } as any,
    });
    console.log("[page.tsx] tenant fetched:", tenant?.slug, "products:", (tenant as any)?.products?.length);
    return tenant;
  } catch (err) {
    console.error("[page.tsx] prisma error:", err);
    return null;
  }
}

export default async function HomePage() {
  const tenant = await getHomeData();
  const products: any[] = tenant?.products?.map((p: any) => ({
    ...p,
    avgRating: p.reviews?.length > 0 ? p.reviews.reduce((s: number, r: any) => s + r.rating, 0) / p.reviews.length : null,
    reviewCount: p.reviews?.length || 0,
  })) ?? [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 font-sans selection:bg-primary/20">
      {/* Carrusel */}
      {tenant?.carouselImages && tenant.carouselImages.length > 0 && (
        <div className="shadow-lg shadow-gray-200/30">
          <HeroCarousel images={tenant.carouselImages} />
        </div>
      )}

      {/* Info del negocio */}
      {tenant?.businessInfo && (
        <section id="nosotros" className="relative overflow-hidden py-24 sm:py-32 bg-white dark:bg-gray-900">
          <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
            <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-green-100 to-emerald-300 dark:from-green-900 dark:to-emerald-900 opacity-40 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
          </div>
          
          <div className="mx-auto max-w-4xl px-6 lg:px-8 relative z-10 text-center">
            <div className="mb-8 flex justify-center">
              <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold text-primary bg-primary/10 ring-1 ring-inset ring-primary/20">
                Sobre nosotros
              </span>
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-600 dark:from-white dark:via-gray-200 dark:to-gray-400 sm:text-6xl mb-8">
              Bienvenidos a {tenant.name}
            </h2>
            <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white dark:border-gray-800 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(255,255,255,0.02)] rounded-3xl p-8 sm:p-12 mx-auto max-w-3xl relative">
              <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300 font-medium">
                {tenant.businessInfo}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Productos destacados */}
      <section id="servicios" className="py-24 bg-slate-50 dark:bg-gray-950 relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <span className="text-primary font-bold tracking-widest text-xs uppercase mb-3 block">Descubre</span>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">Nuestros productos y servicios</h2>
            </div>
            <Link href="/productos" className="inline-flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-white shadow-sm px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all hover:-translate-y-0.5 whitespace-nowrap">
              Ver todos <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      {tenant?.faqs && tenant.faqs.length > 0 && (
        <section id="faq" className="py-24 bg-white dark:bg-gray-900 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 -z-10 w-[200%] max-w-[100vw] sm:max-w-none transform-gpu skew-x-[-30deg] bg-slate-50/50 dark:bg-gray-950/50 ring-1 ring-gray-900/5 dark:ring-white/5 lg:w-1/2"></div>
          
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16">
              <span className="text-primary font-bold tracking-widest text-xs uppercase mb-3 block">Ayuda</span>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">Preguntas Frecuentes</h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Resolvemos las dudas más comunes de nuestros pacientes al instante.</p>
            </div>
            
            <div className="space-y-4">
              {tenant.faqs.map((faq: any) => (
                <details key={faq.id} className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 p-6 text-gray-900 dark:text-white font-semibold text-lg select-none">
                    {faq.question}
                    <span className="shrink-0 transition-transform duration-300 group-open:-rotate-180 bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500 rounded-full p-2 group-hover:text-primary group-open:bg-primary/10 group-open:text-primary">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </summary>
                  <div className="px-6 pb-6 text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed border-t border-gray-50 dark:border-gray-900 pt-4 bg-gray-50/50 dark:bg-gray-950/50">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
