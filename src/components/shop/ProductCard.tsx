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
    <Link href={`/producto/${product.slug}`} className="group card hover:shadow-md transition-shadow flex flex-col p-0 overflow-hidden">
      {/* Imagen */}
      <div className="relative h-48 bg-gray-100 overflow-hidden">
        {product.images[0] ? (
          <Image src={product.images[0]} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Sin imagen</div>
        )}
        {product.images.length > 1 && (
          <div className="absolute bottom-2 right-2 flex gap-1">
            {product.images.slice(0, 3).map((_, idx) => (
              <span key={idx} className="w-1.5 h-1.5 rounded-full bg-white/70 group-hover:bg-primary/80 transition-colors" />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-1 line-clamp-2">{product.name}</h3>

        {/* Rating */}
        {product.avgRating && (
          <div className="flex items-center gap-1 mb-2">
            <Star size={12} className="fill-yellow-400 text-yellow-400" />
            <span className="text-xs text-gray-600">{product.avgRating.toFixed(1)} ({product.reviewCount})</span>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-bold text-primary text-lg">{formatPrice(product.price)}</span>
          <button
            onClick={handleAdd}
            disabled={product.stock === 0}
            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1"
          >
            <ShoppingCart size={14} />
            {product.stock === 0 ? "Agotado" : "Agregar"}
          </button>
        </div>
      </div>
    </Link>
  );
}
