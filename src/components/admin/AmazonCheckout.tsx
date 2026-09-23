"use client";
// src/components/admin/AmazonCheckout.tsx
// Amazon-style in-app custom checkout for subscriptions

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  Check,
  ShieldCheck,
  Lock,
  Loader2,
  CreditCard,
  Sparkles,
  ArrowRight,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { useTranslation } from "@/i18n";

let stripePromise: Promise<any> | null = null;
function getStripe() {
  if (!stripePromise && typeof window !== "undefined") {
    stripePromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
    );
  }
  return stripePromise;
}

interface AmazonCheckoutProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

function CheckoutForm({ onSuccess, onCancel }: AmazonCheckoutProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useTranslation();

  const [selectedPlan, setSelectedPlan] = useState<"STARTER" | "PRO">("STARTER");
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const [cardholderName, setCardholderName] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingSecret, setLoadingSecret] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize SetupIntent on mount
  useEffect(() => {
    async function initSetupIntent() {
      try {
        setLoadingSecret(true);
        setErrorMsg(null);
        const res = await fetch("/api/billing/setup-intent", { method: "POST" });
        const data = await res.json();
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          if (data.currentPlan === "PRO") setSelectedPlan("PRO");
        } else {
          setErrorMsg(data.error || "No se pudo inicializar la pasarela de pago.");
        }
      } catch (err: any) {
        setErrorMsg("Error de conexión al cargar la pasarela segura.");
      } finally {
        setLoadingSecret(false);
      }
    }
    initSetupIntent();
  }, []);

  // Pricing calculations
  const priceStarter = interval === "monthly" ? 29 : 24; // 24/mo billed annually
  const pricePro = interval === "monthly" ? 79 : 64;
  const currentPrice = selectedPlan === "PRO" ? pricePro : priceStarter;
  const billingTotal = interval === "annual" ? currentPrice * 12 : currentPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) return;

    if (!cardholderName.trim()) {
      setErrorMsg("Por favor ingresa el nombre que figura en la tarjeta.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const cardNumberElement = elements.getElement(CardNumberElement);
    if (!cardNumberElement) {
      setErrorMsg("Error al obtener los datos de la tarjeta.");
      setSubmitting(false);
      return;
    }

    try {
      // 1. Confirm Card Setup with Stripe
      const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: {
            name: cardholderName.trim(),
          },
        },
      });

      if (error) {
        setErrorMsg(error.message || "La tarjeta fue rechazada o los datos son inválidos.");
        setSubmitting(false);
        return;
      }

      if (!setupIntent?.payment_method) {
        setErrorMsg("No se pudo registrar el método de pago.");
        setSubmitting(false);
        return;
      }

      // 2. Call backend subscribe endpoint
      const paymentMethodId = typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;

      const subRes = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethodId,
          plan: selectedPlan,
          interval,
        }),
      });

      const subData = await subRes.json();
      if (!subRes.ok || !subData.success) {
        setErrorMsg(subData.error || "No se pudo activar la suscripción.");
        setSubmitting(false);
        return;
      }

      // 3. Success state & Automatic Instant Redirect
      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.href = subData.redirectUrl || "/admin/dashboard?subscribed=true";
        }
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err?.message || "Ocurrió un error inesperado al procesar el pago.");
      setSubmitting(false);
    }
  };

  const elementStyle = {
    base: {
      fontSize: "15px",
      color: "#1e293b",
      "::placeholder": { color: "#94a3b8" },
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
    invalid: {
      color: "#ef4444",
      iconColor: "#ef4444",
    },
  };

  return (
    <div className="max-w-5xl mx-auto my-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden text-gray-800 dark:text-gray-100">
      
      {/* ── Amazon-style Top Header ────────────────────────────────────────── */}
      <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
            N
          </div>
          <div>
            <span className="font-bold tracking-tight text-white text-base">NewAigent</span>
            <span className="text-xs text-gray-400 ml-2 border-l border-gray-700 pl-2">Checkout Seguro</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium bg-emerald-950/60 border border-emerald-800/50 px-3 py-1 rounded-full">
          <Lock size={12} />
          <span>Encriptación SSL 256-bit</span>
        </div>
      </div>

      {/* ── Main Layout: Left form + Right Order Summary ───────────────────── */}
      <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Steps (Plans + Card) */}
        <div className="lg:col-span-7 space-y-6">

          {/* STEP 1: Plan selection */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">1</span>
                Elige tu Plan de Negocio
              </h3>
              
              {/* Interval toggle */}
              <div className="flex bg-gray-200 dark:bg-gray-700 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setInterval("monthly")}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${
                    interval === "monthly"
                      ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  Mensual
                </button>
                <button
                  type="button"
                  onClick={() => setInterval("annual")}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${
                    interval === "annual"
                      ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  Anual <span className="text-emerald-500 font-bold">-20%</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Starter Plan card */}
              <div
                onClick={() => setSelectedPlan("STARTER")}
                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedPlan === "STARTER"
                    ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-xs"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-sm text-gray-900 dark:text-white">Plan Starter</span>
                  {selectedPlan === "STARTER" && <Check size={16} className="text-primary" />}
                </div>
                <div className="text-xl font-black text-gray-900 dark:text-white mb-2">
                  ${priceStarter} <span className="text-xs font-normal text-gray-500">USD/mes</span>
                </div>
                <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                  <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> Tienda online storefront</li>
                  <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> Campañas en FB e Instagram</li>
                  <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> Copiloto Newy AI ($15 crédito)</li>
                </ul>
              </div>

              {/* Pro Plan card */}
              <div
                onClick={() => setSelectedPlan("PRO")}
                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedPlan === "PRO"
                    ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-xs"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-sm text-gray-900 dark:text-white">Plan Pro</span>
                  {selectedPlan === "PRO" && <Check size={16} className="text-primary" />}
                </div>
                <div className="text-xl font-black text-gray-900 dark:text-white mb-2">
                  ${pricePro} <span className="text-xs font-normal text-gray-500">USD/mes</span>
                </div>
                <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                  <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> Todo en Starter + Pro Features</li>
                  <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> Dominio web personalizado</li>
                  <li className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500" /> Copiloto Newy AI ($45 crédito)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* STEP 2: Payment Method (Stripe Elements) */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">2</span>
              Método de Pago (Tarjeta de Crédito o Débito)
            </h3>

            {loadingSecret ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-gray-400">
                <Loader2 size={24} className="animate-spin text-primary" />
                <span className="text-xs">Conectando pasarela segura...</span>
              </div>
            ) : errorMsg && !clientSecret ? (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Cardholder name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Nombre en la tarjeta
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez García"
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
                  />
                </div>

                {/* Card Number */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
                    <span>Número de tarjeta</span>
                    <span className="text-[11px] text-gray-400 font-normal">Visa, Mastercard, Amex</span>
                  </label>
                  <div className="px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-2xs">
                    <CardNumberElement options={{ style: elementStyle, showIcon: true }} />
                  </div>
                </div>

                {/* Expiry & CVC Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Vencimiento (MM/AA)
                    </label>
                    <div className="px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-2xs">
                      <CardExpiryElement options={{ style: elementStyle }} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Código CVC / CVV
                    </label>
                    <div className="px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-2xs">
                      <CardCvcElement options={{ style: elementStyle }} />
                    </div>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Amazon-style Order Summary */}
        <div className="lg:col-span-5">
          <div className="bg-amber-50/50 dark:bg-gray-800/70 border-2 border-amber-200/80 dark:border-amber-900/40 rounded-2xl p-6 sticky top-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
              Resumen del Pedido
            </h3>

            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Plan:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {selectedPlan === "PRO" ? "NewAigent Pro" : "NewAigent Starter"} ({interval === "annual" ? "Anual" : "Mensual"})
                </span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal:</span>
                <span>${billingTotal}.00 USD</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Impuestos estimados:</span>
                <span>$0.00 USD</span>
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-baseline">
                <span className="text-base font-bold text-gray-900 dark:text-white">Total a pagar hoy:</span>
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  ${billingTotal}.00 <span className="text-xs font-normal">USD</span>
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">
                {interval === "annual"
                  ? `Se renovará automáticamente dentro de 1 año por $${billingTotal} USD.`
                  : `Se renovará automáticamente cada mes por $${billingTotal} USD.`} Cancela cuando quieras.
              </p>
            </div>

            {/* Amazon-style Big CTA Button */}
            {success ? (
              <div className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg animate-pulse">
                <Check size={20} className="stroke-[3]" />
                <span>¡Pago Exitoso! Redirigiendo...</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || loadingSecret || !clientSecret}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Confirmando con Stripe...</span>
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Confirmar y Activar Suscripción</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            )}

            {/* Cancel link if provided */}
            {onCancel && !success && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full mt-3 text-center text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 py-1"
              >
                Regresar al panel
              </button>
            )}

            {/* Guarantee / trust badge */}
            <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700/60 flex items-center gap-2.5 text-xs text-gray-500 dark:text-gray-400">
              <ShieldCheck size={24} className="text-emerald-500 shrink-0" />
              <span>Garantía de satisfacción NewAigent. Soporte en español 24/7 y cancelaciones con 1 clic sin penalizaciones.</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function AmazonCheckout(props: AmazonCheckoutProps) {
  const [stripeInstance, setStripeInstance] = useState<Promise<any> | null>(null);

  useEffect(() => {
    setStripeInstance(getStripe());
  }, []);

  if (!stripeInstance) {
    return (
      <div className="py-12 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <Elements stripe={stripeInstance}>
      <CheckoutForm {...props} />
    </Elements>
  );
}
