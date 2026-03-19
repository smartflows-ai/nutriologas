// src/app/(public)/producto/[slug]/page.tsx
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import AddToCartButton from "@/components/shop/AddToCartButton";
import ProductGallery from "@/components/shop/ProductGallery";
import ReviewSection from "@/components/shop/ReviewSection";
import { getTenantSlug } from "@/lib/tenant";

async function getProduct(slug: string) {
  const tenantSlug = getTenantSlug();

  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] },
  });
  if (!tenant) return null;
  return prisma.product.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug } },
    include: {
      reviews: {
        where: { isVisible: true },
        include: { user: { select: { name: true, image: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export default async function ProductoPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = await getProduct(params.slug);
  if (!product || !product.isActive) notFound();

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
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
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
              <span className="text-sm text-gray-600">
                {avgRating.toFixed(1)} ({product.reviews.length} reseñas)
              </span>
            </div>
          )}

          <p className="text-gray-600 leading-relaxed mb-6">
            {product.description}
          </p>

          <div className="mt-auto">
            <p className="text-3xl font-bold text-primary mb-4">
              {formatPrice(product.price)}
            </p>
            {product.stock > 0 ? (
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
            ) : (
              <p className="text-red-500 font-medium">Producto agotado</p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              {product.stock} unidades disponibles
            </p>
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
