// src/app/(public)/producto/[slug]/page.tsx
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Star, Clock, Calendar, MapPin, Video, MessageCircle } from "lucide-react";
import { fill } from "@/lib/utils";
import { priceViewFor, storeAction, whatsappAskUrl } from "@/lib/price-display";
import { loadAssessmentTargets } from "@/lib/assessment-target";
import { getLocaleServer, getTranslationServer } from "@/i18n/server";
import AddToCartButton from "@/components/shop/AddToCartButton";
import ProductGallery from "@/components/shop/ProductGallery";
import ReviewSection from "@/components/shop/ReviewSection";
import { getTenantSlug } from "@/lib/tenant";
import { isBookable } from "@/lib/bookable";
import { modalityModeFor } from "@/lib/patient-intake";

async function getProduct(slug: string) {
  const tenantSlug = getTenantSlug();

  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] },
  });
  if (!tenant) return null;
  const product = await prisma.product.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug } },
    include: {
      reviews: {
        where: { isVisible: true },
        include: { user: { select: { name: true, image: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!product) return null;
  const targets = await loadAssessmentTargets({ id: tenant.id, isBookingEnabled: tenant.isBookingEnabled }, [product]);
  return {
    ...product,
    bookable: isBookable(product, tenant),
    serviceModes: tenant.serviceModes,
    address: tenant.hasPhysicalLocation ? tenant.address : null,
    whatsappNumber: tenant.whatsappNumber,
    assessmentTarget: targets.get(product.id) ?? null,
  };
}

export default async function ProductoPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = await getProduct(params.slug);
  const locale = getLocaleServer();
  const t = getTranslationServer();
  if (!product || !product.isActive) notFound();

  const isService = product.bookable;
  // ASK: the customer chooses when booking. Otherwise the mode is fixed and shown here.
  const visitMode = modalityModeFor(product.serviceModes, product.visitModes);
  // The price (fixed, from or after the assessment) and the one button the page offers for it.
  const price = priceViewFor(product, t.price, locale);
  const action = storeAction(product, { bookable: isService, target: product.assessmentTarget });
  const askUrl = whatsappAskUrl(product.whatsappNumber, fill(t.price.askMessage, { name: product.name }));
  const ctaClass = "w-full py-4 px-6 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[color:var(--on-primary)] font-semibold text-base flex items-center justify-center gap-2.5 transition-all";

  const avgRating =
    product.reviews.length > 0
      ? product.reviews.reduce((s, r) => s + r.rating, 0) /
        product.reviews.length
      : null;

  // Serialize reviews for the client component
  const serializedReviews = product.reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    user: { name: r.user.name, image: r.user.image },
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-14">
        {/* Imagen + galería interactiva */}
        <ProductGallery name={product.name} images={product.images} />

        {/* Info */}
        <div className="flex flex-col">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-3">
            {product.name}
          </h1>

          {avgRating && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={18}
                    className={
                      s <= Math.round(avgRating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }
                  />
                ))}
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {avgRating.toFixed(1)} ({product.reviews.length} reseñas)
              </span>
            </div>
          )}

          <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
            {product.description}
          </p>

          <div className="mt-auto">
            {isService && (
              <div className="flex items-center gap-3 mb-4 p-3.5 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)]">
                <Clock size={18} />
                <span className="text-sm font-semibold">
                  Duración estimada: {product.durationMinutes ?? 30} minutos
                </span>
              </div>
            )}

            {isService && (
              <div className="flex items-center gap-3 mb-4 p-3.5 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)]">
                {visitMode === "ONLINE" ? <Video size={18} /> : <MapPin size={18} />}
                <span className="text-sm font-semibold break-words">
                  {visitMode === "ASK"
                    ? t.booking.modalityEither
                    : visitMode === "ONLINE"
                      ? t.booking.modalityOnline
                      : product.address
                        ? `${t.booking.modalityInPerson}: ${product.address}`
                        : t.booking.modalityInPerson}
                </span>
              </div>
            )}

            <div className="mb-4">
              <p className={`${price.kind === "onRequest" ? "text-2xl" : "text-3xl"} font-semibold text-primary`}>{price.text}</p>
              {price.footnote && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{price.footnote}</p>}
            </div>

            {action.kind === "book" && (
              <Link href={`/agendar/${product.slug}`} className={ctaClass}>
                <Calendar size={18} />
                {t.storefrontUi.agendaCta}
              </Link>
            )}
            {action.kind === "bookTarget" && (
              <Link href={`/agendar/${action.target.slug}`} className={ctaClass}>
                <Calendar size={18} />
                {fill(t.price.bookTarget, { name: action.target.name })}
              </Link>
            )}
            {action.kind === "ask" && askUrl && (
              <a href={askUrl} target="_blank" rel="noopener noreferrer" className={ctaClass}>
                <MessageCircle size={18} />
                {t.price.askAboutPrice}
              </a>
            )}
            {action.kind === "cart" && (
              product.stock > 0 ? (
              <>
                <AddToCartButton
                  product={{
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    images: product.images,
                    slug: product.slug,
                    stock: product.stock,
                  }}
                />
                <p className="text-xs text-gray-400 mt-2">
                  {product.stock} unidades disponibles
                </p>
              </>
              ) : (
                <p className="text-red-500 font-medium">{t.storefrontUi.productSoldOut}</p>
              )
            )}
          </div>
        </div>
      </div>

      {/* Reviews — interactive client component */}
      <ReviewSection
        productId={product.id}
        initialReviews={serializedReviews}
      />
    </div>
  );
}

