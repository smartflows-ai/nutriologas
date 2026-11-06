"use client";
// src/components/marketing/PricingSection.tsx
import { useState, useEffect } from "react";
import OnboardingModal from "./OnboardingModal";
import { useTranslation } from "@/i18n";
import { localeFor } from "@/lib/utils";
import { Check, Star, Stethoscope, ShoppingBag, PawPrint, Plane } from "lucide-react";

type PlanKey = "STARTER" | "PRO";
type Vertical = "HEALTH" | "ECOMMERCE" | "VETERINARY" | "TOURISM";
type PriceSlot = "starter" | "plus" | "pro";

interface PriceBlock {
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
}

interface DynamicPricing {
  es: Record<PriceSlot, PriceBlock>;
  en: Record<PriceSlot, PriceBlock>;
}

// Start, Plus and Pro, monthly billing only. These are fallbacks: the prices come from Stripe (/api/billing/prices).
// Mexico in MXN; other languages in USD (Plus US price is the chosen estimate, pending the live Stripe price).
const FALLBACK_PRICES = {
  es: { start: 499, plus: 899, pro: 1499 },
  en: { start: 29, plus: 49, pro: 79 },
} as const;
const PRICE_SLOT = { start: "starter", plus: "plus", pro: "pro" } as const;
const PLAN_KEYS: Record<keyof typeof PRICE_SLOT, PlanKey> = { start: "STARTER", plus: "PRO", pro: "PRO" }; // signup still has two plans: Plus starts a Pro trial (TODO)
const VERTICAL_ICONS: { id: Vertical; icon: typeof Stethoscope }[] = [
  { id: "HEALTH", icon: Stethoscope },
  { id: "ECOMMERCE", icon: ShoppingBag },
  { id: "VETERINARY", icon: PawPrint },
  { id: "TOURISM", icon: Plane },
];

export default function PricingSection() {
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

  // Every language shows Start, Plus and Pro. The setup fee exists only for Mexico (none defined for the US yet).
  const getPlans = () => {
    const mx = t.pricing.mx;
    const look = {
      start: { color: "var(--mk-cyan)", glow: "rgba(6,182,212,0.15)", popular: false },
      plus: { color: "var(--mk-violet)", glow: "rgba(124,58,237,0.25)", popular: true },
      pro: { color: "var(--mk-indigo)", glow: "rgba(79,70,229,0.15)", popular: false },
    };
    return (Object.keys(PRICE_SLOT) as (keyof typeof PRICE_SLOT)[]).map((id) => {
      const copy = mx.plans[id];
      return {
        id,
        name: copy.name,
        tagline: copy.tagline,
        features: copy.features,
        monthlyPrice: prices?.[langKey]?.[PRICE_SLOT[id]]?.monthlyPrice ?? FALLBACK_PRICES[langKey][id],
        annualPrice: prices?.[langKey]?.[PRICE_SLOT[id]]?.monthlyPrice ?? FALLBACK_PRICES[langKey][id],
        currency: prices?.[langKey]?.[PRICE_SLOT[id]]?.currency ?? fallbackCurrency,
        ...look[id],
        planKey: PLAN_KEYS[id] as PlanKey | null,
        cta: t.pricing.startTrial,
        conversations: copy.conversations,
        measures: copy.measures,
        implementationPrice: isEs ? copy.implementationPrice : undefined,
      };
    });
  };

  type CardPlan = ReturnType<typeof getPlans>[number];
  const plans: CardPlan[] = getPlans();

  const handlePlanClick = (plan: CardPlan) => {
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
                    <span>{isEs ? t.pricing.mx.recommended : t.pricing.mostPopular}</span>
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
                      ${plan.monthlyPrice.toLocaleString(locale)}
                    </span>
                    <span className="text-white/50 mb-2 text-sm">
                      {plan.currency || fallbackCurrency} {t.pricing.perMonth}
                    </span>
                  </div>
                  {plan.conversations !== undefined && (
                    <p className="text-white/60 text-sm mt-2">
                      {plan.conversations.toLocaleString(locale)} {t.pricing.mx.conversationsPerMonth}
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

                {plan.measures && (
                  <p className="text-white/50 text-sm border-t border-white/10 pt-4 mb-4">{plan.measures}</p>
                )}
                {plan.implementationPrice !== undefined && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3 mb-6">
                    <div>
                      <p className="text-white/70 text-sm">{t.pricing.mx.implementationLabel}</p>
                      <p className="text-white/40 text-xs">{t.pricing.mx.implementationNote}</p>
                    </div>
                    <p className="text-white text-xl font-black">${plan.implementationPrice.toLocaleString(locale)}</p>
                  </div>
                )}

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
          initialBillingInterval="monthly"
          initialVertical={selectedVertical}
        />
      )}
    </>
  );
}
