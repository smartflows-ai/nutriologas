"use client";
// src/app/(public)/carrito/page.tsx
import { useCartStore } from "@/store/cart";
import { formatPrice } from "@/lib/utils";
import { Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function CarritoPage() {
  const { items, removeItem, updateQuantity, total, clearCart } = useCartStore();
  const { status } = useSession();
  const router = useRouter();

  const handleCheckout = () => {
    if (status === "authenticated") {
      router.push("/checkout");
    } else {
      router.push("/login?callbackUrl=/checkout");
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <ShoppingBag size={64} className="mx-auto text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-700 mb-2">Tu carrito está vacío</h1>
        <p className="text-gray-500 mb-8">Agrega productos para continuar</p>
        <Link href="/productos" className="btn-primary">Ver productos</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Tu carrito</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="card flex gap-4 p-4">
              <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                {item.image ? <Image src={item.image} alt={item.name} width={80} height={80} className="object-cover w-full h-full" /> : null}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                <p className="text-primary font-bold">{formatPrice(item.price)}</p>
                <div className="flex items-center gap-3 mt-2">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"><Minus size={14} /></button>
                  <span className="font-medium w-6 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"><Plus size={14} /></button>
                </div>
              </div>
              <div className="flex flex-col items-end justify-between">
                <p className="font-bold text-gray-900">{formatPrice(item.price * item.quantity)}</p>
                <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
              </div>
            </div>
          ))}
          <button onClick={clearCart} className="text-sm text-gray-400 hover:text-red-500 transition-colors">Vaciar carrito</button>
        </div>

        {/* Resumen */}
        <div className="card h-fit sticky top-24">
          <h2 className="font-bold text-lg text-gray-900 mb-4">Resumen del pedido</h2>
          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} productos)</span>
              <span>{formatPrice(total())}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-primary">{formatPrice(total())}</span>
            </div>
          </div>
          <button onClick={handleCheckout} className="btn-primary block text-center w-full py-3">Proceder al pago</button>
          <Link href="/productos" className="btn-ghost block text-center w-full py-2 mt-2 text-sm">Seguir comprando</Link>
        </div>
      </div>
    </div>
  );
}
