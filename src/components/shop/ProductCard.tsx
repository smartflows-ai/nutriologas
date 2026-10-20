"use client";
// src/components/shop/ProductCard.tsx
import Image from "next/image";
import Link from "next/link";
import { Star, ShoppingCart, Calendar, Clock } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatPrice, localeFor, fill } from "@/lib/utils";
import { toast } from "@/hooks/useToast";
import { useTranslation } from "@/i18n";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  avgRating?: number | null;
  reviewCount?: number;
  stock: number;
  itemType?: "PHYSICAL" | "SERVICE" | "PACKAGE" | "SUBSCRIPTION";
  durationMinutes?: number | null;
  requiresBooking?: boolean;
}

export default function ProductCard({ product }: { product: Product }) {
  const { t, lang } = useTranslation();
  const locale = localeFor(lang);
  const addItem = useCartStore((s) => s.addItem);
  const isBooking = product.requiresBooking || product.itemType === "SERVICE";

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({ id: product.id, name: product.name, price: product.price, image: product.images[0], slug: product.slug });
    toast(fill(t.productUi.addedToCart, { name: product.name }));
  };

  const handleBooking = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = `/agendar/${product.slug}`;
  };

  return (
    <Link href={isBooking ? `/agendar/${product.slug}` : `/producto/${product.slug}`} className="group relative bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm dark:hover:shadow-[0_8px_40px_rgb(255,255,255,0.05)] transition-all duration-500 flex flex-col overflow-hidden">
      {/* Image */}
      <div className="relative aspect-[4/5] bg-gray-50/50 dark:bg-gray-800/50 overflow-hidden w-full rounded-t-[2rem]">
        {product.images[0] ? (
          <Image src={product.images[0]} alt={product.name} fill className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">{t.productUi.noImage}</div>
        )}

        {isBooking && (
          <div className="absolute top-3 left-3 z-10">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/90 dark:bg-gray-900/90 text-primary shadow-sm flex items-center gap-1">
              <Clock size={12} />{" "}
              {product.durationMinutes ? fill(t.productUi.minutesShort, { minutes: product.durationMinutes }) : t.productUi.service}
            </span>
          </div>
        )}

        {/* Subtle gradient to frame the image and button */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Hover CTA overlay (desktop) */}
        <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out left-0 right-0 hidden md:block z-10">
          {isBooking ? (
            <button
              onClick={handleBooking}
              className="w-full bg-primary hover:opacity-90 text-white font-semibold py-3.5 rounded-xl hover:brightness-110 transition-all text-sm flex items-center justify-center gap-2"
            >
              <Calendar size={18} />
              {t.productUi.bookAppointment} {product.durationMinutes ? `(${product.durationMinutes}m)` : ""}
            </button>
          ) : (
            <button
              onClick={handleAdd}
              disabled={product.stock === 0}
              className="w-full bg-primary text-white font-semibold py-3.5 rounded-xl hover:brightness-110 transition-all text-sm flex items-center justify-center gap-2"
            >
              <ShoppingCart size={18} />
              {product.stock === 0 ? t.productUi.soldOut : t.productUi.addToCart}
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-6 flex flex-col flex-1">
        <div className="flex justify-between items-start gap-4 mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white text-lg tracking-tight leading-snug line-clamp-2 group-hover:text-primary transition-colors">{product.name}</h3>
          <span className="font-semibold text-gray-900 dark:text-white text-xl whitespace-nowrap">{formatPrice(product.price, locale)}</span>
        </div>

        {/* Rating */}
        {product.avgRating && (
          <div className="flex items-center gap-1.5 mt-auto pt-2">
            <div className="flex items-center">
              <Star size={14} className="fill-yellow-400 text-yellow-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{product.avgRating.toFixed(1)}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">{fill(t.productUi.reviewsCount, { count: product.reviewCount ?? 0 })}</span>
          </div>
        )}

        {/* Mobile CTA (small screens only) */}
        <div className="mt-4 md:hidden">
          {isBooking ? (
            <button
              onClick={handleBooking}
              className="w-full bg-primary text-white hover:brightness-110 shadow-sm font-semibold py-2.5 px-4 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
            >
              <Calendar size={16} />
              {t.productUi.bookShort}
            </button>
          ) : (
            <button
              onClick={handleAdd}
              disabled={product.stock === 0}
              className="w-full bg-primary text-white hover:brightness-110 shadow-sm font-semibold py-2.5 px-4 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
            >
              <ShoppingCart size={16} />
              {product.stock === 0 ? t.productUi.soldOut : t.productUi.addShort}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
