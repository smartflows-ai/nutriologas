"use client";
// src/app/(public)/checkout/page.tsx
import { useCartStore } from "@/store/cart";
import { formatPrice } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import {
  CreditCard,
  Building2,
  CheckCircle,
  Download,
  ArrowRight,
  Clock,
} from "lucide-react";
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
        setCheckoutRequestId(reqId);
        setPendingOrderId(orderId);
        setStage("iframe");
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [hydrated]);

  const { status } = useSession();

  // Handle Conekta redirect
  const searchParams = useSearchParams();
  const coneKtaOrderId = searchParams.get("order_id");
  const paymentStatus = searchParams.get("payment_status");

  // If we have Conekta redirect params, try to find the order and redirect
  useEffect(() => {
    if (coneKtaOrderId && paymentStatus) {
      // First try localStorage — we stored the DB orderId when creating the checkout
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const { orderId } = JSON.parse(stored);
          if (orderId) {
            localStorage.removeItem(STORAGE_KEY);
            router.push(`/pedido/${orderId}?success=true`);
            return;
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      // Fallback: look up by Conekta order ID via API
      fetch("/api/checkout/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: coneKtaOrderId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.orderId) {
            router.push(`/pedido/${data.orderId}?success=true`);
          } else {
            router.push("/productos");
          }
        })
        .catch(() => {
          router.push("/productos");
        });
    }
  }, [coneKtaOrderId, paymentStatus, router]);

  // Don't render anything if we're handling a Conekta redirect
  if (coneKtaOrderId && paymentStatus) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-gray-500">Procesando pago...</p>
      </div>
    );
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/checkout");
    }
  }, [status, router]);

  useEffect(() => {
    // Only redirect to /carrito if we're in select stage, cart is empty, and there's no pending order
    // Don't redirect if we're in iframe stage (processing payment) even if cart is empty
    if (hydrated && !items.length && stage === "select" && !pendingOrderId) {
      router.push("/carrito");
    }
  }, [hydrated, items.length, stage, pendingOrderId, router]);

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
    // Cart already cleared in onPaymentConfirmed, just navigate to order page
    router.push(`/pedido/${orderId}?success=true`);
  };

  const handleConektaExit = () => {
    setStage("select");
    setCheckoutRequestId("");
    setPendingOrderId("");
    // Clear localStorage when user exits checkout
    localStorage.removeItem(STORAGE_KEY);
  };

  // Removed success screen - user stays on iframe page with "Ver pedido" button

  // ── Conekta iframe ──────────────────────────────────────
  if (stage === "iframe" && checkoutRequestId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <button
          onClick={handleConektaExit}
          disabled={stage === "iframe" && !!pendingOrderId}
          className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Volver
        </button>
        <ConektaCheckout
          checkoutRequestId={checkoutRequestId}
          orderId={pendingOrderId}
          onSuccess={handleConektaSuccess}
          onPaymentConfirmed={() => {
            // Use setTimeout to ensure navigation happens first
            setTimeout(() => {
              clearCart();
              localStorage.removeItem(STORAGE_KEY);
            }, 1000);
          }}
          onError={() => {
            setError("Hubo un error con el pago. Intenta de nuevo.");
            setStage("select");
          }}
          onExit={handleConektaExit}
        />
      </div>
    );
  }

  // Don't render anything if we're handling a Conekta redirect
  if (coneKtaOrderId && paymentStatus) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-gray-500">Procesando pago...</p>
      </div>
    );
  }

  // ── Method selector ─────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Checkout</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Payment methods */}
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Método de pago</h2>
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
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Resumen</h2>
          <div className="space-y-2 text-sm">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-gray-600 dark:text-gray-400">
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
