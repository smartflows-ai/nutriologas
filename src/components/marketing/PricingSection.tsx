"use client";
// src/components/marketing/PricingSection.tsx
import { useState, useEffect } from "react";
import OnboardingModal from "./OnboardingModal";
import { useTranslation } from "@/i18n";
import { localeFor } from "@/lib/utils";
import { Check, Star, Stethoscope, ShoppingBag, PawPrint, Plane } from "lucide-react";

type PlanKey = "STARTER" | "PRO";
type Vertical = "HEALTH" | "ECOMMERCE" | "VETERINARY" | "TOURISM";
type PriceSlot = "starter" | "pro" | "enterprise";

interface PriceBlock {
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
}

interface DynamicPricing {
  es: Record<PriceSlot, PriceBlock>;
  en: Record<PriceSlot, PriceBlock>;
}

// Fallback prices, used until /api/billing/prices responds. [monthly, annual] per language.
const FALLBACK_PRICES: Record<Vertical, { starter: [number, number]; pro: [number, number] }> = {
  ECOMMERCE: { starter: [500, 375], pro: [1500, 1000] },
  HEALTH: { starter: [500, 375], pro: [800, 600] },
  VETERINARY: { starter: [500, 375], pro: [1000, 800] },
  TOURISM: { starter: [500, 375], pro: [1200, 950] },
};
const FALLBACK_ENTERPRISE: [number, number] = [3999, 2999];
const FALLBACK_EN: Record<string, [number, number]> = {
  "starter:ECOMMERCE": [29, 19], "pro:ECOMMERCE": [79, 59],
  "starter:HEALTH": [29, 19], "pro:HEALTH": [45, 35],
  "starter:VETERINARY": [29, 19], "pro:VETERINARY": [55, 42],
  "starter:TOURISM": [29, 19], "pro:TOURISM": [65, 50],
  "enterprise:": [199, 149],
};

const VERTICAL_ICONS: { id: Vertical; icon: typeof Stethoscope }[] = [
  { id: "HEALTH", icon: Stethoscope },
  { id: "ECOMMERCE", icon: ShoppingBag },
  { id: "VETERINARY", icon: PawPrint },
  { id: "TOURISM", icon: Plane },
];

export default function PricingSection() {
  const [annual, setAnnual] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("STARTER");
  const [selectedVertical, setSelectedVertical] = useState<Vertical>("HEALTH");
  const { t, lang } = useTranslation();
  const locale = localeFor(lang);
  const isEs = lang === "es";

  const [prices, setPrices] = useState<DynamicPricing | null>(null);

  useEffect(() => {
    fetch("/api/billing/prices")
      .then((res) => res.json())
      .then((data) => {
        if (data?.es && data?.en) {
          setPrices(data);
        }
      })
      .catch(() => { /* fail silently: fallback prices are used */ });
  }, []);

  const langKey = isEs ? "es" : "en";
  const fallbackCurrency = isEs ? "MXN" : "USD";

  // Price for a plan slot: API value when loaded, otherwise the fallback table for the active language
  const priceFor = (slot: PriceSlot, vertical: Vertical) => {
    const api = prices?.[langKey]?.[slot];
    if (api) return { monthly: api.monthlyPrice, annual: api.annualPrice, currency: api.currency };
    const fallbackKey = slot === "enterprise" ? "enterprise:" : `${slot}:${vertical}`;
    const [monthly, annualPrice] = isEs
      ? slot === "enterprise" ? FALLBACK_ENTERPRISE : FALLBACK_PRICES[vertical][slot]
      : FALLBACK_EN[fallbackKey];
    return { monthly, annual: annualPrice, currency: fallbackCurrency };
  };

  // Plans for the selected vertical. ECOMMERCE keeps the original copy keys; other verticals use the dictionary.
  const getVerticalPlans = () => {
    const isEcommerce = selectedVertical === "ECOMMERCE";
    const planCopy = (slot: PriceSlot) => {
      if (isEcommerce) {
        if (slot === "starter") return { name: "Starter", tagline: t.pricing.starterTagline, features: t.pricing.starterFeatures };
        if (slot === "pro") return { name: "Pro", tagline: t.pricing.proTagline, features: t.pricing.proFeatures };
        return { name: "Enterprise", tagline: t.pricing.enterpriseTagline, features: t.pricing.enterpriseFeatures };
      }
      const copy = t.pricing.verticals[selectedVertical][slot];
      return { name: copy.name, tagline: copy.tagline, features: copy.features ?? t.pricing.enterpriseFeatures };
    };

    const build = (slot: PriceSlot, look: { color: string; glow: string; popular: boolean }) => {
      const copy = planCopy(slot);
      const price = priceFor(slot, selectedVertical);
      return {
        id: slot,
        name: copy.name,
        tagline: copy.tagline,
        features: copy.features,
        monthlyPrice: price.monthly,
        annualPrice: price.annual,
        currency: price.currency,
        color: look.color,
        glow: look.glow,
        popular: look.popular,
        planKey: slot === "enterprise" ? null : (slot === "starter" ? "STARTER" : "PRO") as PlanKey | null,
        cta: slot === "enterprise" ? t.pricing.contactSales : t.pricing.startTrial,
      };
    };

    const proLook = {
      ECOMMERCE: { color: "var(--mk-violet)", glow: "rgba(124,58,237,0.2)" },
      HEALTH: { color: "var(--mk-violet)", glow: "rgba(124,58,237,0.25)" },
      VETERINARY: { color: "var(--mk-emerald)", glow: "rgba(16,185,129,0.25)" },
      TOURISM: { color: "var(--mk-amber)", glow: "rgba(245,158,11,0.25)" },
    }[selectedVertical];

    return [
      build("starter", { color: "var(--mk-cyan)", glow: "rgba(6,182,212,0.15)", popular: false }),
      build("pro", { ...proLook, popular: true }),
      build("enterprise", { color: "var(--mk-indigo)", glow: "rgba(79,70,229,0.15)", popular: false }),
    ];
  };

  const plans = getVerticalPlans();

  const handlePlanClick = (plan: typeof plans[number]) => {
    if (!plan.planKey) {
      window.location.href = `mailto:info@newaigent.com?subject=${encodeURIComponent(t.pricing.enterpriseSubject)}`;
      return;
    }
    setSelectedPlan(plan.planKey);
    setShowModal(true);
  };

  return (
    <>
      <section
        id="pricing"
        className="relative py-28 overflow-hidden"
        style={{ background: "var(--mk-bg)" }}
      >
        {/* Background orbs */}
        <div
          className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-10 blur-[120px] pointer-events-none"
          style={{ background: "radial-gradient(circle, var(--mk-violet), transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-10 blur-[100px] pointer-events-none"
          style={{ background: "radial-gradient(circle, var(--mk-cyan), transparent 70%)" }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-mk-violet/30 bg-mk-violet/10 mb-6">
              <span className="text-xs font-bold text-mk-violet-light uppercase tracking-widest">
                {t.pricing.badge}
              </span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 tracking-tight">
              {t.pricing.headline1}{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, var(--mk-violet-light) 0%, var(--mk-cyan) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {t.pricing.headline2}
              </span>
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto mb-10">
              {t.pricing.subtitle}
            </p>

            {/* Vertical tabs selector */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8 max-w-2xl mx-auto">
              {VERTICAL_ICONS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVertical(v.id)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 border ${
                    selectedVertical === v.id
                      ? "bg-mk-violet/20 text-white border-mk-violet shadow-[0_0_20px_rgba(124,58,237,0.3)] scale-105"
                      : "bg-mk-card text-white/60 border-white/10 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <v.icon size={14} />
                  <span>{t.pricing.verticalTabs[v.id]}</span>
                </button>
              ))}
            </div>

            {/* Billing toggle */}
            <div className="inline-flex items-center gap-4 bg-mk-card border border-white/10 rounded-2xl p-1.5">
              <button
                id="billing-monthly"
                onClick={() => setAnnual(false)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  !annual
                    ? "bg-mk-violet text-white shadow-[0_0_20px_rgba(124,58,237,0.4)]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {t.pricing.monthly}
              </button>
              <button
                id="billing-annual"
                onClick={() => setAnnual(true)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  annual
                    ? "bg-mk-violet text-white shadow-[0_0_20px_rgba(124,58,237,0.4)]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {t.pricing.annual}
                <span className="ml-2 text-[10px] bg-mk-emerald/20 text-mk-emerald px-1.5 py-0.5 rounded-full border border-mk-emerald/30">
                  {t.pricing.save}
                </span>
              </button>
            </div>
          </div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.id}
                id={`plan-${plan.id}`}
                className="relative rounded-3xl p-8 border flex flex-col transition-all duration-300 hover:-translate-y-2"
                style={{
                  background: plan.popular
                    ? `radial-gradient(ellipse at top, ${plan.glow} 0%, var(--mk-card) 60%)`
                    : "var(--mk-card)",
                  borderColor: plan.popular ? plan.color + "60" : "rgba(255,255,255,0.08)",
                  boxShadow: plan.popular ? `0 0 60px ${plan.glow}` : "none",
                }}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div
                    className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5 shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${plan.color}, var(--mk-indigo))` }}
                  >
                    <Star size={12} className="fill-white text-white" />
                    <span>{t.pricing.mostPopular}</span>
                  </div>
                )}

                {/* Plan name & tagline */}
                <div className="mb-6">
                  <h3 className="text-xl font-black mb-1" style={{ color: plan.color }}>
                    {plan.name}
                  </h3>
                  <p className="text-white/50 text-sm">{plan.tagline}</p>
                </div>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-end gap-1">
                    <span className="text-5xl font-black text-white transition-all duration-300">
                      ${(annual ? plan.annualPrice : plan.monthlyPrice).toLocaleString(locale)}
                    </span>
                    <span className="text-white/50 mb-2 text-sm">
                      {plan.currency || fallbackCurrency} {t.pricing.perMonth}
                    </span>
                  </div>
                  {annual && plan.monthlyPrice > plan.annualPrice && (
                    <p className="text-mk-emerald text-xs font-semibold mt-1">
                      {t.pricing.billedAnnually}{((plan.monthlyPrice - plan.annualPrice) * 12).toLocaleString(locale)} {plan.currency}{t.pricing.savePerYear}
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span
                        className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: plan.color + "20", color: plan.color }}
                      >
                        <Check size={10} strokeWidth={3} />
                      </span>
                      <span className="text-white/60 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  id={`plan-${plan.id}-cta`}
                  onClick={() => handlePlanClick(plan)}
                  className="w-full text-center px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                  style={
                    plan.popular
                      ? {
                          background: `linear-gradient(135deg, ${plan.color}, var(--mk-indigo))`,
                          color: "white",
                          boxShadow: `0 8px 30px ${plan.glow}`,
                        }
                      : {
                          background: "rgba(255,255,255,0.04)",
                          color: "white",
                          border: `1px solid ${plan.color}30`,
                        }
                  }
                >
                  {plan.cta} →
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-white/40 text-sm mt-10">
            {t.pricing.finePrint}
          </p>
        </div>
      </section>

      {showModal && (
        <OnboardingModal
          onClose={() => setShowModal(false)}
          initialPlan={selectedPlan}
          initialBillingInterval={annual ? "annual" : "monthly"}
          initialVertical={selectedVertical}
        />
      )}
    </>
  );
}
