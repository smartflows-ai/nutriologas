"use client";
// src/components/shop/ConektaCheckout.tsx
import { useEffect, useRef, useState } from "react";
import type { ConektaOrderResult } from "@/types/conekta";
import { Download, CheckCircle, X, ArrowRight } from "lucide-react";

interface Props {
  checkoutRequestId: string;
  orderId: string;
  onSuccess: (orderId: string) => void;
  onPaymentConfirmed?: (orderId: string) => void;
  onError?: (error: unknown) => void;
  onExit?: () => void;
}

const CONEKTA_SCRIPT_SRC =
  "https://pay.conekta.com/v1.0/js/conekta-checkout.min.js";
const CONEKTA_SCRIPT_ID = "conekta-checkout-script";

function loadConektaScript(timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.ConektaCheckoutComponents) {
      resolve();
      return;
    }

    const startPolling = () => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (window.ConektaCheckoutComponents) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          reject(new Error("Conekta.js timed out"));
        }
      }, 100);
    };

    const existing = document.getElementById(CONEKTA_SCRIPT_ID);
    if (existing) {
      startPolling();
      return;
    }

    const script = document.createElement("script");
    script.id = CONEKTA_SCRIPT_ID;
    script.src = CONEKTA_SCRIPT_SRC;
    script.async = true;
    script.onload = () => startPolling();
    script.onerror = () =>
      reject(new Error(`Failed to fetch ${CONEKTA_SCRIPT_SRC}`));
    document.body.appendChild(script);
  });
}

export function ConektaCheckout({
  checkoutRequestId,
  orderId,
  onSuccess,
  onPaymentConfirmed,
  onError,
  onExit,
}: Props) {
  const [iframeReady, setIframeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(
    null,
  );
  const [redirectTriggered, setRedirectTriggered] = useState(false);

  // Stable refs to avoid re-mount when parent re-renders
  const callbacksRef = useRef({
    onSuccess,
    onPaymentConfirmed,
    onError,
    onExit,
  });
  callbacksRef.current = { onSuccess, onPaymentConfirmed, onError, onExit };

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadConektaScript();
      } catch (err) {
        console.error("[Conekta] Script load error:", err);
        if (!cancelled)
          setError(
            "No se pudo cargar Conekta. Verifica tu conexión e intenta de nuevo.",
          );
        return;
      }

      if (cancelled) return;

      const el = document.getElementById("conekta-checkout-container");
      if (!el || el.childNodes.length > 0) return;

      try {
        window.ConektaCheckoutComponents.Integration({
          config: {
            locale: "es",
            publicKey: process.env.NEXT_PUBLIC_CONEKTA_PUBLIC_KEY ?? "",
            targetIFrame: "#conekta-checkout-container",
            checkoutRequestId,
          },
          options: {
            backgroundMode: "lightMode",
            colorPrimary: "var(--color-primary, #16a34a)",
            inputType: "flatMode",
          },
          callbacks: {
            onGetInfoSuccess: () => {
              if (!cancelled) setIframeReady(true);
            },
            onFinalizePayment: async (conektaOrder: ConektaOrderResult) => {
              try {
                await fetch("/api/checkout/confirm", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ orderId, conektaOrder }),
                });
                // Store payment reference for download
                const charge = conektaOrder?.charges?.data?.[0];
                const reference =
                  charge?.payment_method?.type === "cash"
                    ? charge?.payment_method?.barcode
                    : conektaOrder?.id;
                setPaymentReference(reference ?? null);
                setPaymentMethod(charge?.payment_method?.type ?? null);
                setPaymentCompleted(true);
                // Call onPaymentConfirmed immediately to clear cart (if provided)
                callbacksRef.current.onPaymentConfirmed?.(orderId);
                // Start 5-second countdown to auto-redirect
                setRedirectCountdown(5);
                const interval = setInterval(() => {
                  setRedirectCountdown((prev) => {
                    if (prev === 1) {
                      clearInterval(interval);
                      console.log(
                        "[ConektaCheckout] Auto-redirecting to order page",
                      );
                      if (!redirectTriggered) {
                        setRedirectTriggered(true);
                        callbacksRef.current.onSuccess(orderId);
                      }
                      return 0;
                    }
                    return prev ? prev - 1 : 0;
                  });
                }, 1000);
                // Do NOT call onSuccess here - keep iframe visible so user can see/download info
              } catch (err) {
                callbacksRef.current.onError?.(err);
              }
            },
            onErrorPayment: (err: unknown) => {
              console.error("[Conekta] Payment error:", err);
              callbacksRef.current.onError?.(err);
            },
            onExit: () => callbacksRef.current.onExit?.(),
          },
        });
      } catch (err) {
        console.error("[Conekta] Integration error:", err);
        if (!cancelled)
          setError(
            "Error al inicializar el formulario de pago. Intenta de nuevo.",
          );
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [checkoutRequestId, orderId]);

  // Force iframe dimensions when Conekta resets them to 0
  useEffect(() => {
    const el = document.getElementById("conekta-checkout-container");
    if (!el) return;

    const forceIframeSize = () => {
      const iframe = el.querySelector("iframe");
      if (iframe && iframe.offsetHeight < 100) {
        iframe.style.width = "100%";
        iframe.style.minHeight = "600px";
        iframe.style.height = "600px";
        iframe.style.border = "none";
      }
    };

    const observer = new MutationObserver(() => forceIframeSize());
    observer.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "height"],
    });

    const interval = setInterval(forceIframeSize, 500);
    const cleanup = setTimeout(() => clearInterval(interval), 10_000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
      clearTimeout(cleanup);
    };
  }, []);

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-red-500 text-sm mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary text-sm px-4 py-2"
        >
          Recargar página
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {!iframeReady && (
        <div className="flex flex-col justify-center items-center py-16 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-gray-600 text-sm">
            Cargando formulario de pago...
          </p>
          <p className="text-gray-500 text-xs text-center max-w-xs">
            Esto puede tomar unos segundos. Por favor, no cierres esta página.
          </p>
        </div>
      )}

      {/* Payment completed overlay - shows download option */}
      {paymentCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-500" size={24} />
              <div>
                <h3 className="font-semibold text-green-800">
                  {paymentMethod === "cash"
                    ? "Referencia OXXO generada"
                    : "Pago procesado"}
                </h3>
                <p className="text-sm text-green-600">
                  {paymentMethod === "cash"
                    ? "Descarga tu referencia para pagar en OXXO"
                    : "Tu pago ha sido confirmado"}
                </p>
                {paymentReference && paymentMethod === "cash" && (
                  <p className="text-xs font-mono text-green-700 mt-1">
                    Ref: {paymentReference}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={async () => {
                // Download payment reference as text file
                const content =
                  paymentMethod === "cash"
                    ? `REFERENCIA DE PAGO OXXO\n\nOrden: ${orderId}\nReferencia: ${paymentReference}\n\nInstrucciones:\n1. Presenta esta referencia en cualquier tienda OXXO\n2. Realiza el pago en efectivo\n3. Tu orden se activará una vez confirmado el pago\n\nVálido por 24 horas`
                    : `CONFIRMACIÓN DE PAGO\n\nOrden: ${orderId}\nMétodo: Tarjeta\nStatus: Pagado\n\nGracias por tu compra!`;
                const blob = new Blob([content], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `ticket-${orderId}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Download size={16} />
              Descargar referencia
            </button>
          </div>
        </div>
      )}

      {/* Keep iframe container fully visible and interactive */}
      <div
        id="conekta-checkout-container"
        style={{
          minHeight: 600,
          width: "100%",
        }}
      />

      {/* Action buttons after payment */}
      {paymentCompleted && (
        <div className="flex flex-col gap-3 mt-4">
          <button
            onClick={() => {
              console.log("[ConektaCheckout] Manual redirect to order page");
              if (!redirectTriggered) {
                setRedirectTriggered(true);
                callbacksRef.current.onSuccess(orderId);
              }
            }}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={redirectCountdown !== null}
          >
            Ver detalles del pedido
            <ArrowRight size={18} />
          </button>
          {redirectCountdown !== null && (
            <p className="text-center text-sm text-gray-600">
              Redirigiendo en {redirectCountdown} segundos...
            </p>
          )}
          <button
            onClick={() => callbacksRef.current.onExit?.()}
            className="btn-ghost flex items-center justify-center gap-2"
          >
            <X size={18} />
            <span>Salir</span>
          </button>
        </div>
      )}
    </div>
  );
}
