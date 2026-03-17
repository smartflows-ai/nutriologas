"use client";
// src/app/(public)/checkout/page.tsx
import { useCartStore } from "@/store/cart";
import { formatPrice } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { CreditCard, Building2 } from "lucide-react";

type Method = "card" | "oxxo" | "paypal";

export default function CheckoutPage() {
  const { items, total, clearCart } = useCartStore();
  const router = useRouter();
  const [method, setMethod] = useState<Method>("card");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConektaPayment = async () => {
    setLoading(true);
    setError("");
    try {
      // En produccion: tokenizar con Conekta.js antes de llamar al API
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
          paymentMethod: method === "card" ? "CARD_CONEKTA" : "OXXO_CONEKTA",
          paymentReference: "demo-ref-" + Date.now(),
        }),
      });
      if (!res.ok) throw new Error("Error procesando el pago");
      const order = await res.json();
      clearCart();
      router.push(`/?order=${order.id}&success=true`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!items.length) {
    router.push("/carrito");
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Métodos de pago */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-4">Método de pago</h2>
          <div className="space-y-3 mb-6">
            {[
              { id: "card" as Method, label: "Tarjeta de crédito/débito", icon: <CreditCard size={18} /> },
              { id: "oxxo" as Method, label: "OXXO Pay", icon: <Building2 size={18} /> },
              { id: "paypal" as Method, label: "PayPal", icon: <span className="font-bold text-blue-600 text-sm">PP</span> },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${method === m.id ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}
              >
                <span className="text-primary">{m.icon}</span>
                <span className="font-medium text-sm">{m.label}</span>
              </button>
            ))}
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {method !== "paypal" ? (
            <button onClick={handleConektaPayment} disabled={loading} className="btn-primary w-full py-3">
              {loading ? "Procesando..." : `Pagar ${formatPrice(total())}`}
            </button>
          ) : (
            <PayPalScriptProvider options={{ clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "test" }}>
              <PayPalButtons
                createOrder={(_, actions) =>
                  actions.order.create({ intent: "CAPTURE", purchase_units: [{ amount: { currency_code: "MXN", value: total().toFixed(2) } }] })
                }
                onApprove={async (_, actions) => {
                  await actions.order?.capture();
                  await fetch("/api/orders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ items: items.map((i) => ({ productId: i.id, quantity: i.quantity })), paymentMethod: "PAYPAL" }),
                  });
                  clearCart();
                  router.push("/?success=true");
                }}
              />
            </PayPalScriptProvider>
          )}
        </div>

        {/* Resumen */}
        <div className="card h-fit">
          <h2 className="font-semibold text-gray-900 mb-4">Resumen</h2>
          <div className="space-y-2 text-sm">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-gray-600">
                <span className="truncate flex-1 mr-2">{item.name} ×{item.quantity}</span>
                <span>{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-4 pt-4 flex justify-between font-bold">
            <span>Total</span>
            <span className="text-primary">{formatPrice(total())}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
