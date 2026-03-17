// src/app/(public)/producto/[slug]/page.tsx
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Star, ShoppingCart } from "lucide-react";
import { formatPrice, formatDate } from "@/lib/utils";
import AddToCartButton from "@/components/shop/AddToCartButton";
import ProductGallery from "@/components/shop/ProductGallery";

async function getProduct(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "clinica-demo" } });
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

export default async function ProductoPage({ params }: { params: { slug: string } }) {
  const product = await getProduct(params.slug);
  if (!product || !product.isActive) notFound();

  const avgRating = product.reviews.length > 0
    ? product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-14">
        {/* Imagen + galería interactiva */}
        <ProductGallery name={product.name} images={product.images} />

        {/* Info */}
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{product.name}</h1>

          {avgRating && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} size={18} className={s <= Math.round(avgRating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} />
                ))}
              </div>
              <span className="text-sm text-gray-600">{avgRating.toFixed(1)} ({product.reviews.length} reseñas)</span>
            </div>
          )}

          <p className="text-gray-600 leading-relaxed mb-6">{product.description}</p>

          <div className="mt-auto">
            <p className="text-3xl font-bold text-primary mb-4">{formatPrice(product.price)}</p>
            {product.stock > 0 ? (
              <AddToCartButton product={{ id: product.id, name: product.name, price: product.price, images: product.images, slug: product.slug, stock: product.stock }} />
            ) : (
              <p className="text-red-500 font-medium">Producto agotado</p>
            )}
            <p className="text-xs text-gray-400 mt-2">{product.stock} unidades disponibles</p>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Reseñas ({product.reviews.length})</h2>
        {product.reviews.length === 0 ? (
          <p className="text-gray-400">Aún no hay reseñas para este producto.</p>
        ) : (
          <div className="space-y-4">
            {product.reviews.map((review) => (
              <div key={review.id} className="card">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                    {review.user.name?.charAt(0).toUpperCase() ?? "U"}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900">{review.user.name ?? "Usuario"}</p>
                    <p className="text-xs text-gray-400">{formatDate(review.createdAt)}</p>
                  </div>
                  <div className="ml-auto flex">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} size={14} className={s <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} />
                    ))}
                  </div>
                </div>
                {review.comment && <p className="text-gray-600 text-sm">{review.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
