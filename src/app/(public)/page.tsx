// src/app/(public)/page.tsx
import { prisma } from "@/lib/db";
import HeroCarousel from "@/components/shop/HeroCarousel";
import ProductCard from "@/components/shop/ProductCard";
import Link from "next/link";
import { getTranslationServer } from "@/i18n/server";
import { getTenantSlug } from "@/lib/tenant";
import MarketingPage from "@/components/marketing/MarketingPage";
import { MapPin, UserRound } from "lucide-react";
import { directionsUrl } from "@/lib/location";
import { getVerticalProfile } from "@/lib/vertical-profile";

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

export default async function TenantPage() {
  const slug = getTenantSlug();
  const t = getTranslationServer();

  // ── Root domain (localhost:3000 / newaigent.com) ───────────────────────────
  // Show the NewAigent marketing / sales landing page.
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

  // Service-first verticals (health, veterinary, travel...) show their catalog as services
  const serviceFirst = getVerticalProfile(tenant?.vertical, !!tenant?.isBookingEnabled).serviceFirst;
  const isBooking = tenant?.isBookingEnabled || serviceFirst;
  const sectionTitle = serviceFirst
    ? t.storefrontUi.servicesAndConsults
    : isBooking
    ? t.storefrontUi.ourServices
    : t.storefront.home.ourProducts;
  const sectionDesc = serviceFirst
    ? t.storefrontUi.healthSectionDesc
    : isBooking
    ? t.storefrontUi.serviceSectionDesc
    : t.storefront.home.discoverProducts;
  const catalogBtnText = serviceFirst || isBooking ? t.storefrontUi.viewServices : t.storefront.home.viewCatalog;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 font-sans selection:bg-primary/20">
      {/* Carrusel */}
      {tenant?.carouselImages && tenant.carouselImages.length > 0 && (
        <div className=" shadow-gray-200/30">
          <HeroCarousel images={tenant.carouselImages} />
        </div>
      )}

      {/* Info del negocio */}
      {(tenant?.businessInfo || tenant?.ownerName || (tenant?.hasPhysicalLocation && tenant?.address)) && (
        <section id="nosotros" className="py-16 sm:py-24 bg-slate-50 dark:bg-gray-950">
          <div className="mx-auto max-w-3xl px-6">
            <div className="card p-6 sm:p-10">
              <p className="text-sm font-medium text-primary">{t.storefront.home.aboutUs}</p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white">
                {t.storefront.home.welcomeTo} {tenant.name}
              </h2>
              {tenant.businessInfo && (
                <p className="mt-6 text-base sm:text-lg leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-line break-words">
                  {tenant.businessInfo}
                </p>
              )}
              {(tenant.ownerName || (tenant.hasPhysicalLocation && tenant.address)) && (
                <dl className="mt-8 divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
                  {tenant.ownerName && (
                    <div className="flex items-center justify-between gap-4 py-3">
                      <dt className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 shrink-0">
                        <UserRound size={16} strokeWidth={1.5} className="shrink-0" />
                        {t.locationUi.ownerLabel}
                      </dt>
                      <dd className="min-w-0 break-words text-right text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                        {tenant.ownerName}
                      </dd>
                    </div>
                  )}
                  {tenant.hasPhysicalLocation && tenant.address && (
                    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <dt className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 shrink-0">
                        <MapPin size={16} strokeWidth={1.5} className="shrink-0" />
                        {t.locationUi.addressLabel}
                      </dt>
                      <dd className="flex min-w-0 flex-col gap-1.5 sm:items-end">
                        <span className="break-words text-sm sm:text-base text-gray-900 dark:text-white sm:text-right">
                          {tenant.address}
                        </span>
                        <a
                          href={directionsUrl(tenant)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-gray-900 dark:text-white underline underline-offset-4 decoration-primary hover:opacity-80 transition-opacity"
                        >
                          {t.locationUi.directions}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Productos destacados */}
      <section id="servicios" className="py-16 sm:py-24 bg-white dark:bg-gray-950 relative overflow-hidden">
        {/* Subtle top border gradient */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gray-200 dark:bg-gray-800" />
        
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 dark:text-white tracking-tight mb-3">{sectionTitle}</h2>
              <p className="text-base text-gray-500 dark:text-gray-400">{sectionDesc}</p>
            </div>
            <Link href="/productos" className="btn-secondary whitespace-nowrap">
              {catalogBtnText} <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} bookingEnabled={!!tenant?.isBookingEnabled} />
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      {tenant?.faqs && tenant.faqs.length > 0 && (
        <section id="faq" className="py-16 sm:py-24 bg-slate-50 dark:bg-gray-950 relative">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-10">
              <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 mb-4">{t.storefront.home.help}</span>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white">{t.storefront.home.faq}</h2>
              <p className="mt-3 text-base text-gray-600 dark:text-gray-400">{t.storefront.home.faqDesc}</p>
            </div>
            
            <div className="space-y-3">
              {tenant.faqs.map((faq: any) => (
                <details key={faq.id} className="group bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 sm:p-6 text-gray-900 dark:text-white font-medium text-base sm:text-lg select-none outline-none">
                    {faq.question}
                    <span className="shrink-0 transition-transform duration-300 group-open:rotate-180 text-gray-500 dark:text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                    </span>
                  </summary>
                  <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-base text-gray-600 dark:text-gray-400 whitespace-pre-line leading-relaxed">
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
