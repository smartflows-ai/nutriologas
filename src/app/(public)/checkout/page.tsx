"use client";
// src/app/(public)/checkout/page.tsx
import { useCartStore } from "@/store/cart";
import { formatPrice } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { CreditCard, Building2, CheckCircle } from "lucide-react";
import { ConektaCheckout } from "@/components/shop/ConektaCheckout";

type Method = "card" | "oxxo" | "paypal";
type Stage = "select" | "iframe" | "success";

const STORAGE_KEY = "conekta_checkout_pending";

export default function CheckoutPage() {
  const { items, total, clearCart } = useCartStore();
  const router = useRouter();

  const [method, setMethod] = useState<Method>("card");
  const [stage, setStage] = useState<Stage>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkoutRequestId, setCheckoutRequestId] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState("");

  // Wait for Zustand to hydrate from localStorage before checking cart
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Try to restore pending checkout from localStorage on mount
  useEffect(() => {
    if (!hydrated) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const { orderId, checkoutRequestId: reqId } = JSON.parse(stored);
        console.log(
          "[checkout] Restoring pending checkout from localStorage:",
          reqId,
        );
        setCheckoutRequestId(reqId);
        setPendingOrderId(orderId);
        setStage("iframe");
      } catch (e) {
        console.error("[checkout] Failed to parse stored checkout data");
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [hydrated]);

  const { status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/checkout");
    }
  }, [status, router]);

  useEffect(() => {
    if (hydrated && !items.length && stage === "select") {
      router.push("/carrito");
    }
  }, [hydrated, items.length, stage, router]);

  if (!hydrated || status === "loading" || status === "unauthenticated")
    return null;
  if (!items.length && stage === "select") return null;

  const initiateConektaCheckout = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
          paymentMethod: method === "oxxo" ? "OXXO_CONEKTA" : "CARD_CONEKTA",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al iniciar el pago");

      // Store in localStorage to persist across page reloads
      const checkoutData = {
        orderId: data.orderId,
        checkoutRequestId: data.checkoutRequestId,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checkoutData));
      console.log(
        "[checkout] Saved checkout data to localStorage:",
        checkoutData,
      );

      setCheckoutRequestId(data.checkoutRequestId);
      setPendingOrderId(data.orderId);
      setStage("iframe");
    } catch (e: any) {
      setError(e.message);
      // Clear storage on error
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  };

  const handleConektaSuccess = (orderId: string) => {
    clearCart();
    setStage("success");
    // Clear localStorage on successful payment
    localStorage.removeItem(STORAGE_KEY);
    console.log("[checkout] Payment successful, cleared localStorage");
    setTimeout(() => router.push(`/pedido/${orderId}?success=true`), 2000);
  };

  const handleConektaExit = () => {
    setStage("select");
    setCheckoutRequestId("");
    setPendingOrderId("");
    // Clear localStorage when user exits checkout
    localStorage.removeItem(STORAGE_KEY);
    console.log("[checkout] User exited checkout, cleared localStorage");
  };

  // ── Success screen ──────────────────────────────────────
  if (stage === "success") {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <CheckCircle className="mx-auto mb-4 text-green-500" size={56} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          ¡Pago recibido!
        </h1>
        <p className="text-gray-500 text-sm">Redirigiendo a tu pedido…</p>
      </div>
    );
  }

  // ── Conekta iframe ──────────────────────────────────────
  if (stage === "iframe" && checkoutRequestId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <button
          onClick={handleConektaExit}
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1"
        >
          ← Volver al carrito
        </button>
        <ConektaCheckout
          checkoutRequestId={checkoutRequestId}
          orderId={pendingOrderId}
          onSuccess={handleConektaSuccess}
          onError={(err) => {
            console.error(err);
            setError("Hubo un error con el pago. Intenta de nuevo.");
            setStage("select");
          }}
          onExit={handleConektaExit}
        />
      </div>
    );
  }

  // ── Method selector ─────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Payment methods */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-4">Método de pago</h2>
          <div className="space-y-3 mb-6">
            {[
              {
                id: "card" as Method,
                label: "Tarjeta de crédito/débito",
                icon: <CreditCard size={18} />,
              },
              {
                id: "oxxo" as Method,
                label: "OXXO Pay",
                icon: <Building2 size={18} />,
              },
              {
                id: "paypal" as Method,
                label: "PayPal",
                icon: (
                  <span className="font-bold text-blue-600 text-sm">PP</span>
                ),
              },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
                  method === m.id
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className="text-primary">{m.icon}</span>
                <span className="font-medium text-sm">{m.label}</span>
              </button>
            ))}
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {method !== "paypal" ? (
            <button
              onClick={initiateConektaCheckout}
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading ? "Preparando pago…" : `Pagar ${formatPrice(total())}`}
            </button>
          ) : (
            <PayPalScriptProvider
              options={{
                clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "test",
              }}
            >
              <PayPalButtons
                createOrder={(_, actions) =>
                  actions.order.create({
                    intent: "CAPTURE",
                    purchase_units: [
                      {
                        amount: {
                          currency_code: "MXN",
                          value: total().toFixed(2),
                        },
                      },
                    ],
                  })
                }
                onApprove={async (_, actions) => {
                  await actions.order?.capture();
                  const res = await fetch("/api/orders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      items: items.map((i) => ({
                        productId: i.id,
                        quantity: i.quantity,
                      })),
                      paymentMethod: "PAYPAL",
                    }),
                  });
                  const data = await res.json();
                  clearCart();
                  router.push(`/pedido/${data.id}?success=true`);
                }}
              />
            </PayPalScriptProvider>
          )}
        </div>

        {/* Order summary */}
        <div className="card h-fit">
          <h2 className="font-semibold text-gray-900 mb-4">Resumen</h2>
          <div className="space-y-2 text-sm">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-gray-600">
                <span className="truncate flex-1 mr-2">
                  {item.name} ×{item.quantity}
                </span>
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
