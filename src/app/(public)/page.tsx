// src/app/(public)/page.tsx
import { prisma } from "@/lib/db";
import HeroCarousel from "@/components/shop/HeroCarousel";
import ProductCard from "@/components/shop/ProductCard";
import Link from "next/link";
import { getTenantSlug } from "@/lib/tenant";
import MarketingPage from "@/components/marketing/MarketingPage";

async function getHomeData(): Promise<any> {
  const tenantSlug = getTenantSlug();

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
    return tenant;
  } catch (err) {
    console.error("[page.tsx] prisma error:", err);
    return null;
  }
}

export default async function HomePage() {
  const slug = getTenantSlug();

  // ── Root domain (localhost:3000 / newaigent.com) ───────────────────────────
  // Show the NeoAigent marketing / sales landing page.
  if (!slug) {
    return <MarketingPage />;
  }

  // ── Tenant subdomain ───────────────────────────────────────────────────────
  // Render the tenant's own storefront (unchanged).
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
        <section id="nosotros" className="relative py-24 sm:py-32 bg-slate-50 dark:bg-gray-950 overflow-hidden">
          {/* Decorative glowing blobs using BOTH primary and secondary DB colors */}
          <div className="absolute top-1/4 left-1/4 -translate-x-1/2 w-[600px] h-[600px] bg-[var(--color-primary)]/20 dark:bg-[var(--color-primary)]/5 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 translate-x-1/4 w-[600px] h-[600px] bg-[var(--color-secondary)]/15 dark:bg-[var(--color-secondary)]/5 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="mx-auto max-w-5xl px-6 lg:px-8 relative z-10">
            <div className="bg-white/70 dark:bg-gray-900/40 backdrop-blur-3xl border border-white dark:border-gray-800 shadow-[0_8px_40px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_40px_rgb(255,255,255,0.02)] rounded-[3rem] p-10 sm:p-16 lg:p-20 flex flex-col items-center text-center">
              <span className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 ring-1 ring-inset ring-[var(--color-primary)]/30 mb-8 uppercase tracking-widest shadow-[0_0_20px_var(--color-primary)]/10">
                Sobre Nosotros
              </span>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 mb-8 leading-[1.1]">
                Bienvenidos a {tenant.name}
              </h2>
              <div className="max-w-3xl border-t border-gray-100 dark:border-gray-800 pt-8">
                <p className="text-xl sm:text-2xl leading-relaxed text-gray-700 dark:text-gray-300 font-medium tracking-wide">
                  {tenant.businessInfo}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Productos destacados */}
      <section id="servicios" className="py-24 sm:py-32 bg-white dark:bg-[#07070f] relative overflow-hidden">
        {/* Subtle top border gradient */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-primary)]/20 to-transparent" />
        
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight mb-4">Nuestros Productos</h2>
              <p className="text-lg text-gray-500 dark:text-gray-400">Descubre nuestros productos destacados seleccionados especialmente para ti.</p>
            </div>
            <Link href="/productos" className="inline-flex items-center justify-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white shadow-lg shadow-[var(--color-primary)]/25 px-8 py-4 rounded-2xl font-bold transition-all hover:-translate-y-1 hover:shadow-[var(--color-primary)]/40 whitespace-nowrap">
              Ver catálogo completo <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      {tenant?.faqs && tenant.faqs.length > 0 && (
        <section id="faq" className="py-24 sm:py-32 bg-slate-50 dark:bg-gray-950 relative">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16">
              <span className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 ring-1 ring-inset ring-[var(--color-primary)]/20 mb-6 uppercase tracking-widest">Ayuda</span>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-gray-900 dark:text-white">Preguntas Frecuentes</h2>
              <p className="mt-6 text-xl text-gray-600 dark:text-gray-400 font-medium">Respuestas rápidas a las dudas más comunes.</p>
            </div>
            
            <div className="space-y-6">
              {tenant.faqs.map((faq: any) => (
                <details key={faq.id} className="group bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.01)] transition-all duration-300 overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 p-8 text-gray-900 dark:text-white font-bold text-xl select-none outline-none">
                    {faq.question}
                    <span className="shrink-0 transition-transform duration-500 group-open:rotate-180 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded-full p-3 group-hover:text-[var(--color-primary)] group-open:bg-[var(--color-primary)]/10 group-open:text-[var(--color-primary)]">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                    </span>
                  </summary>
                  <div className="px-8 pb-8 text-lg text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed -mt-2">
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
