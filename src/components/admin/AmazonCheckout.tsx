"use client";
// src/components/admin/AmazonCheckout.tsx
// In-app checkout for NewAigent subscriptions. SaaS-global billing UI: always dark brand, never tenant-themed.

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
import { Check, ShieldCheck, Lock, Loader2, ArrowRight, AlertCircle } from "lucide-react";
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

// Stripe Elements render inside an iframe, so they need literal values instead of CSS variables.
const elementStyle = {
  base: {
    fontSize: "15px",
    color: "#f1f5f9",
    "::placeholder": { color: "#64748b" },
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  },
  invalid: {
    color: "#f87171",
    iconColor: "#f87171",
  },
};

const fieldWrap = "px-3.5 py-2.5 rounded-xl border border-white/10 bg-mk-surface";
const fieldLabel = "block text-xs font-semibold text-white/70 mb-1.5";
const errorBox = "p-3 bg-mk-red/10 border border-mk-red/20 rounded-xl text-xs text-mk-red flex items-center gap-2";

function CheckoutForm({ onSuccess, onCancel }: AmazonCheckoutProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useTranslation();

  const [selectedPlan, setSelectedPlan] = useState<"STARTER" | "PLUS" | "PRO">("STARTER");
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  // Plus is monthly only: switching to annual moves the selection back to Start.
  useEffect(() => {
    if (interval === "annual" && selectedPlan === "PLUS") setSelectedPlan("STARTER");
  }, [interval, selectedPlan]);
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
          if (data.currentPlan === "PRO" || data.currentPlan === "PLUS") setSelectedPlan(data.currentPlan);
        } else {
          setErrorMsg(data.error || t.billing.errorInitFailed);
        }
      } catch (err: any) {
        setErrorMsg(t.billing.errorConnection);
      } finally {
        setLoadingSecret(false);
      }
    }
    initSetupIntent();
  }, []);

  // Currency and prices come from the server (the business's currency: MXN for Mexico, USD otherwise).
  const [checkoutConfig, setCheckoutConfig] = useState<{
    currency: "mxn" | "usd";
    prices: {
      starter: { monthly: number | null; annualPerMonth: number | null };
      plus: { monthly: number | null };
      pro: { monthly: number | null; annualPerMonth: number | null };
    };
  } | null>(null);
  useEffect(() => {
    fetch("/api/billing/checkout-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setCheckoutConfig(data); })
      .catch(() => {});
  }, []);
  const currency = checkoutConfig?.currency ?? "usd";
  const currencyCode = currency.toUpperCase();
  const isMxn = currency === "mxn";
  // Mexico has monthly prices only.
  useEffect(() => {
    if (isMxn && interval === "annual") setInterval("monthly");
  }, [isMxn, interval]);

  // Pricing calculations (fallbacks match the published prices if Stripe cannot be read)
  const fallback = isMxn ? { starter: 499, plus: 899, pro: 1499 } : { starter: 29, plus: 49, pro: 79 };
  const cfg = checkoutConfig?.prices;
  const priceStarter = interval === "monthly" ? (cfg?.starter.monthly ?? fallback.starter) : (cfg?.starter.annualPerMonth ?? 24);
  const pricePro = interval === "monthly" ? (cfg?.pro.monthly ?? fallback.pro) : (cfg?.pro.annualPerMonth ?? 64);
  const pricePlus = cfg?.plus.monthly ?? fallback.plus; // monthly only
  const currentPrice = selectedPlan === "PRO" ? pricePro : selectedPlan === "PLUS" ? pricePlus : priceStarter;
  const billingTotal = interval === "annual" ? currentPrice * 12 : currentPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) return;

    if (!cardholderName.trim()) {
      setErrorMsg(t.billing.errorNameRequired);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const cardNumberElement = elements.getElement(CardNumberElement);
    if (!cardNumberElement) {
      setErrorMsg(t.billing.errorCardData);
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
        setErrorMsg(error.message || t.billing.errorCardRejected);
        setSubmitting(false);
        return;
      }

      if (!setupIntent?.payment_method) {
        setErrorMsg(t.billing.errorMethodNotRegistered);
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
        setErrorMsg(subData.error || t.billing.errorSubscribeFailed);
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
      setErrorMsg(err?.message || t.billing.errorUnexpected);
      setSubmitting(false);
    }
  };

  const planCard = (plan: "STARTER" | "PLUS" | "PRO", price: number, features: string[]) => {
    const selected = selectedPlan === plan;
    return (
      <div
        onClick={() => setSelectedPlan(plan)}
        className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all ${
          selected ? "border-mk-violet bg-mk-violet/10" : "border-white/10 hover:border-white/25"
        }`}
      >
        <div className="flex justify-between items-start mb-1">
          <span className="font-bold text-sm text-white">
            {plan === "PRO" ? t.billing.planPro : plan === "PLUS" ? t.billing.planPlus : t.billing.planStarter}
          </span>
          {selected && <Check size={16} className="text-mk-violet-light" />}
        </div>
        <div className="text-xl font-black text-white mb-2">
          ${price} <span className="text-xs font-normal text-white/50">{t.billing.perMonth.replace("USD", currencyCode)}</span>
        </div>
        <ul className="text-xs text-white/60 space-y-1">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-1.5">
              <Check size={12} className="text-mk-emerald shrink-0" /> {feature}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto my-4 mk-card overflow-hidden text-white shadow-2xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-mk-raised text-white px-6 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/NewAigent-white-pet.png" alt="NewAigent" className="w-8 h-8 rounded-lg object-contain" />
          <div>
            <span className="font-bold tracking-tight text-white text-base">NewAigent</span>
            <span className="text-xs text-white/50 ml-2 border-l border-white/15 pl-2">{t.billing.secureCheckout}</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-mk-emerald text-xs font-medium bg-mk-emerald/10 border border-mk-emerald/25 px-3 py-1 rounded-full">
          <Lock size={12} />
          <span>{t.billing.sslEncryption}</span>
        </div>
      </div>

      {/* ── Main Layout: Left form + Right Order Summary ───────────────────── */}
      <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT COLUMN: Steps (Plans + Card) */}
        <div className="lg:col-span-7 space-y-6">

          {/* STEP 1: Plan selection */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-mk-gradient text-white text-xs flex items-center justify-center font-bold">1</span>
                {t.billing.selectPlan}
              </h3>

              {/* Interval toggle */}
              <div className="flex bg-white/5 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setInterval("monthly")}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${
                    interval === "monthly" ? "bg-mk-violet text-white shadow" : "text-white/60 hover:text-white"
                  }`}
                >
                  {t.billing.intervalMonthly}
                </button>
                <button
                  type="button"
                  onClick={() => setInterval("annual")}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${
                    interval === "annual" ? "bg-mk-violet text-white shadow" : "text-white/60 hover:text-white"
                  } ${isMxn ? "hidden" : ""}`}
                >
                  {t.billing.intervalAnnual} <span className="text-mk-emerald font-bold">{t.billing.annualSavings}</span>
                </button>
              </div>
            </div>

            <div className={`grid grid-cols-1 gap-3 ${interval === "monthly" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              {planCard("STARTER", priceStarter, t.billing.startFeatures)}
              {interval === "monthly" && planCard("PLUS", pricePlus, t.billing.plusFeatures)}
              {planCard("PRO", pricePro, t.billing.proFeatures)}
            </div>
          </div>

          {/* STEP 2: Payment Method (Stripe Elements) */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <span className="w-5 h-5 rounded-full bg-mk-gradient text-white text-xs flex items-center justify-center font-bold">2</span>
              {t.billing.paymentMethod}
            </h3>

            {loadingSecret ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-white/50">
                <Loader2 size={24} className="animate-spin text-mk-violet-light" />
                <span className="text-xs">{t.billing.connectingGateway}</span>
              </div>
            ) : errorMsg && !clientSecret ? (
              <div className={errorBox}>
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Cardholder name */}
                <div>
                  <label className={fieldLabel}>{t.billing.cardholderName}</label>
                  <input
                    type="text"
                    required
                    placeholder={t.billing.cardholderPlaceholder}
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    className={`${fieldWrap} w-full text-sm text-white placeholder-white/30 focus:outline-none focus:border-mk-violet focus:ring-4 focus:ring-mk-violet/20`}
                  />
                </div>

                {/* Card Number */}
                <div>
                  <label className={`${fieldLabel} flex items-center justify-between`}>
                    <span>{t.billing.cardNumber}</span>
                    <span className="text-[11px] text-white/40 font-normal">{t.billing.cardBrands}</span>
                  </label>
                  <div className={fieldWrap}>
                    <CardNumberElement options={{ style: elementStyle, showIcon: true }} />
                  </div>
                </div>

                {/* Expiry & CVC Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={fieldLabel}>{t.billing.expiry}</label>
                    <div className={fieldWrap}>
                      <CardExpiryElement options={{ style: elementStyle }} />
                    </div>
                  </div>
                  <div>
                    <label className={fieldLabel}>{t.billing.cvc}</label>
                    <div className={fieldWrap}>
                      <CardCvcElement options={{ style: elementStyle }} />
                    </div>
                  </div>
                </div>

                {errorMsg && (
                  <div className={errorBox}>
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Order Summary */}
        <div className="lg:col-span-5">
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 sticky top-6">
            <h3 className="text-base font-bold text-white mb-4 pb-3 border-b border-white/10">
              {t.billing.orderSummary}
            </h3>

            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between text-white/60">
                <span>{t.billing.planLabel}</span>
                <span className="font-semibold text-white">
                  {selectedPlan === "PRO" ? t.billing.planNamePro : selectedPlan === "PLUS" ? t.billing.planNamePlus : t.billing.planNameStarter} ({interval === "annual" ? t.billing.intervalAnnual : t.billing.intervalMonthly})
                </span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>{t.billing.subtotal}</span>
                <span>${billingTotal}.00 {currencyCode}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>{t.billing.estimatedTaxes}</span>
                <span>$0.00 {currencyCode}</span>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-between items-baseline">
                <span className="text-base font-bold text-white">{t.billing.totalToday}</span>
                <span className="mk-text-gradient text-2xl font-black">
                  ${billingTotal}.00 <span className="text-xs font-normal">{currencyCode}</span>
                </span>
              </div>
              <p className="text-[11px] text-white/50 italic">
                {(interval === "annual" ? t.billing.renewsAnnual : t.billing.renewsMonthly).replace("{amount}", String(billingTotal)).replace("{currency}", currencyCode)}{" "}
                {t.billing.cancelAnytime}
              </p>
            </div>

            {/* Primary CTA */}
            {success ? (
              <div className="w-full py-4 bg-mk-emerald text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg animate-pulse">
                <Check size={20} className="stroke-[3]" />
                <span>{t.billing.paymentSuccess}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || loadingSecret || !clientSecret}
                className="mk-btn-primary w-full py-3.5 text-sm cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{t.billing.confirmingStripe}</span>
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>{t.billing.confirmActivate}</span>
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
                className="w-full mt-3 text-center text-xs text-white/50 hover:text-white py-1"
              >
                {t.billing.backToDashboard}
              </button>
            )}

            {/* Guarantee / trust badge */}
            <div className="mt-5 pt-4 border-t border-white/10 flex items-center gap-2.5 text-xs text-white/50">
              <ShieldCheck size={24} className="text-mk-emerald shrink-0" />
              <span>{t.billing.guarantee}</span>
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
        <Loader2 className="animate-spin text-mk-violet-light" size={32} />
      </div>
    );
  }

  return (
    <Elements stripe={stripeInstance}>
      <CheckoutForm {...props} />
    </Elements>
  );
}
