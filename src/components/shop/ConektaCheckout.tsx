"use client";
// src/components/shop/ConektaCheckout.tsx
import { useEffect, useRef, useState } from "react";
import type { ConektaOrderResult } from "@/types/conekta";

interface Props {
  checkoutRequestId: string;
  orderId: string;
  onSuccess: (orderId: string) => void;
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
    script.onerror = () => reject(new Error(`Failed to fetch ${CONEKTA_SCRIPT_SRC}`));
    document.body.appendChild(script);
  });
}

export function ConektaCheckout({
  checkoutRequestId,
  orderId,
  onSuccess,
  onError,
  onExit,
}: Props) {
  const [iframeReady, setIframeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable refs to avoid re-mount when parent re-renders
  const callbacksRef = useRef({ onSuccess, onError, onExit });
  callbacksRef.current = { onSuccess, onError, onExit };

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadConektaScript();
      } catch (err) {
        console.error("[Conekta] Script load error:", err);
        if (!cancelled) setError("No se pudo cargar Conekta. Verifica tu conexión e intenta de nuevo.");
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
                callbacksRef.current.onSuccess(orderId);
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
        if (!cancelled) setError("Error al inicializar el formulario de pago. Intenta de nuevo.");
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
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}
      <div id="conekta-checkout-container" style={{ minHeight: 600, width: "100%" }} />
    </div>
  );
}
