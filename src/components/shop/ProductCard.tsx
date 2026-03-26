"use client";
// src/components/shop/ProductCard.tsx
import Image from "next/image";
import Link from "next/link";
import { Star, ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatPrice } from "@/lib/utils";
import { toast } from "@/hooks/useToast";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  avgRating?: number | null;
  reviewCount?: number;
  stock: number;
}

export default function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({ id: product.id, name: product.name, price: product.price, image: product.images[0], slug: product.slug });
    toast(`${product.name} agregado al carrito`);
  };

  return (
    <Link href={`/producto/${product.slug}`} className="group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.03)] transition-all duration-300 flex flex-col overflow-hidden">
      {/* Imagen */}
      <div className="relative aspect-[4/5] bg-gray-50/50 dark:bg-gray-800/50 overflow-hidden w-full">
        {product.images[0] ? (
          <Image src={product.images[0]} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Sin imagen</div>
        )}
        
        {/* Hover Add to Cart Overlay (Desktop) */}
        <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 left-0 right-0 hidden md:block">
          <button
            onClick={handleAdd}
            disabled={product.stock === 0}
            className="w-full bg-[var(--color-primary)] text-white font-semibold py-3 rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
          >
            <ShoppingCart size={16} />
            {product.stock === 0 ? "Agotado" : "Añadir a la bolsa"}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start gap-4 mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white text-base leading-tight line-clamp-2">{product.name}</h3>
          <span className="font-bold text-[var(--color-primary)] text-lg whitespace-nowrap">{formatPrice(product.price)}</span>
        </div>

        {/* Rating */}
        {product.avgRating && (
          <div className="flex items-center gap-1.5 mt-auto pt-2">
            <div className="flex items-center">
              <Star size={14} className="fill-yellow-400 text-yellow-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{product.avgRating.toFixed(1)}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">({product.reviewCount} opiniones)</span>
          </div>
        )}

        {/* Mobile Add to Cart (Visible only on small screens) */}
        <div className="mt-4 md:hidden">
          <button
            onClick={handleAdd}
            disabled={product.stock === 0}
            className="w-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white font-medium py-2.5 px-4 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
          >
            <ShoppingCart size={16} />
            {product.stock === 0 ? "Agotado" : "Añadir"}
          </button>
        </div>
      </div>
    </Link>
  );
}
