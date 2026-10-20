"use client";

import { useTranslation } from "@/i18n";
import { fill } from "@/lib/utils";
// src/components/shop/AddToCartButton.tsx
import { ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { toast } from "@/hooks/useToast";

interface Props {
  product: { id: string; name: string; price: number; images: string[]; slug: string; stock: number };
}

export default function AddToCartButton({ product }: Props) {
  const { t } = useTranslation();
  const addItem = useCartStore((s) => s.addItem);
  return (
    <button
      onClick={() => {
        addItem({ id: product.id, name: product.name, price: product.price, image: product.images[0], slug: product.slug });
        toast(fill(t.productUi.addedToCart, { name: product.name }));
      }}
      className="btn-primary flex items-center gap-2 w-full justify-center py-3 text-base"
    >
      <ShoppingCart size={20} /> Agregar al carrito
    </button>
  );
}
