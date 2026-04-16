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
    <Link href={`/producto/${product.slug}`} className="group relative bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-2xl dark:hover:shadow-[0_8px_40px_rgb(255,255,255,0.05)] hover:-translate-y-1 transition-all duration-500 flex flex-col overflow-hidden">
      {/* Imagen */}
      <div className="relative aspect-[4/5] bg-gray-50/50 dark:bg-gray-800/50 overflow-hidden w-full rounded-t-[2rem]">
        {product.images[0] ? (
          <Image src={product.images[0]} alt={product.name} fill className="object-cover group-hover:scale-110 transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Sin imagen</div>
        )}
        
        {/* Subtle gradient to frame the image and button */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Hover Add to Cart Overlay (Desktop) */}
        <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 translate-y-8 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ease-out left-0 right-0 hidden md:block z-10">
          <button
            onClick={handleAdd}
            disabled={product.stock === 0}
            className="w-full bg-[var(--color-primary)] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[var(--color-primary)]/30 hover:brightness-110 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
          >
            <ShoppingCart size={18} />
            {product.stock === 0 ? "Agotado" : "Añadir a la bolsa"}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-6 flex flex-col flex-1">
        <div className="flex justify-between items-start gap-4 mb-2">
          <h3 className="font-bold text-gray-900 dark:text-white text-lg tracking-tight leading-snug line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">{product.name}</h3>
          <span className="font-black text-gray-900 dark:text-white text-xl whitespace-nowrap">{formatPrice(product.price)}</span>
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
            className="w-full bg-[var(--color-primary)] text-white hover:brightness-110 shadow-sm shadow-[var(--color-primary)]/20 font-bold py-2.5 px-4 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
          >
            <ShoppingCart size={16} />
            {product.stock === 0 ? "Agotado" : "Añadir"}
          </button>
        </div>
      </div>
    </Link>
  );
}
