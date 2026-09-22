"use client";
// src/components/marketing/PricingSection.tsx
import { useState, useEffect } from "react";
import OnboardingModal from "./OnboardingModal";
import { useTranslation } from "@/i18n";
import { Check, Star } from "lucide-react";

type PlanKey = "STARTER" | "PRO";

interface DynamicPricing {
  es: {
    starter: { monthlyPrice: number; annualPrice: number; currency: string };
    pro: { monthlyPrice: number; annualPrice: number; currency: string };
    enterprise: { monthlyPrice: number; annualPrice: number; currency: string };
  };
  en: {
    starter: { monthlyPrice: number; annualPrice: number; currency: string };
    pro: { monthlyPrice: number; annualPrice: number; currency: string };
    enterprise: { monthlyPrice: number; annualPrice: number; currency: string };
  };
}

export default function PricingSection() {
  const [annual, setAnnual] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("STARTER");
  const { t, lang } = useTranslation();

  // Language is managed by LanguageProvider
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
      .catch(() => { /* fail silently — pricing defaults are used as fallback */ });
  }, []);

  const langKey = isEs ? "es" : "en";
  const currentPrices = prices?.[langKey];

  const starterMonthly = currentPrices?.starter.monthlyPrice ?? (isEs ? 500 : 29);
  const starterAnnual = currentPrices?.starter.annualPrice ?? (isEs ? 375 : 19);
  const starterCurrency = currentPrices?.starter.currency ?? (isEs ? "MXN" : "USD");

  const proMonthly = currentPrices?.pro.monthlyPrice ?? (isEs ? 1500 : 79);
  const proAnnual = currentPrices?.pro.annualPrice ?? (isEs ? 1000 : 59);
  const proCurrency = currentPrices?.pro.currency ?? (isEs ? "MXN" : "USD");

  const enterpriseMonthly = currentPrices?.enterprise.monthlyPrice ?? (isEs ? 3999 : 199);
  const enterpriseAnnual = currentPrices?.enterprise.annualPrice ?? (isEs ? 2999 : 149);
  const enterpriseCurrency = currentPrices?.enterprise.currency ?? (isEs ? "MXN" : "USD");

  const plans = [
    {
      id: "starter" as PlanKey,
      name: "Starter",
      tagline: t.pricing.starterTagline,
      monthlyPrice: starterMonthly,
      annualPrice: starterAnnual,
      currency: starterCurrency,
      color: "#06B6D4",
      glow: "rgba(6,182,212,0.15)",
      popular: false,
      features: t.pricing.starterFeatures,
      cta: t.pricing.startTrial,
      planKey: "STARTER" as PlanKey,
    },
    {
      id: "pro" as PlanKey,
      name: "Pro",
      tagline: t.pricing.proTagline,
      monthlyPrice: proMonthly,
      annualPrice: proAnnual,
      currency: proCurrency,
      color: "#7C3AED",
      glow: "rgba(124,58,237,0.2)",
      popular: true,
      features: t.pricing.proFeatures,
      cta: t.pricing.startTrial,
      planKey: "PRO" as PlanKey,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      tagline: t.pricing.enterpriseTagline,
      monthlyPrice: enterpriseMonthly,
      annualPrice: enterpriseAnnual,
      currency: enterpriseCurrency,
      color: "#4F46E5",
      glow: "rgba(79,70,229,0.15)",
      popular: false,
      features: t.pricing.enterpriseFeatures,
      cta: t.pricing.contactSales,
      planKey: null,
    },
  ];

  const handlePlanClick = (plan: typeof plans[number]) => {
    if (!plan.planKey) {
      // Enterprise → mailto
      window.location.href = "mailto:info@newaigent.com?subject=Enterprise%20Plan%20Inquiry";
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
        style={{ background: "#07070f" }}
      >
        {/* Background orbs */}
        <div
          className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-10 blur-[120px] pointer-events-none"
          style={{ background: "radial-gradient(circle, #7C3AED, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-10 blur-[100px] pointer-events-none"
          style={{ background: "radial-gradient(circle, #06B6D4, transparent 70%)" }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-violet-500/30 bg-violet-500/10 mb-6">
              <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">
                {t.pricing.badge}
              </span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 tracking-tight">
              {t.pricing.headline1}{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #A78BFA 0%, #06B6D4 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {t.pricing.headline2}
              </span>
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto mb-10">
              {t.pricing.subtitle}
            </p>

            {/* Billing toggle */}
            <div className="inline-flex items-center gap-4 bg-[#0d0d1a] border border-white/10 rounded-2xl p-1.5">
              <button
                id="billing-monthly"
                onClick={() => setAnnual(false)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  !annual
                    ? "bg-violet-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.4)]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {t.pricing.monthly}
              </button>
              <button
                id="billing-annual"
                onClick={() => setAnnual(true)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  annual
                    ? "bg-violet-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.4)]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {t.pricing.annual}
                <span className="ml-2 text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full border border-green-500/30">
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
                    ? `radial-gradient(ellipse at top, ${plan.glow} 0%, #0d0d1a 60%)`
                    : "#0d0d1a",
                  borderColor: plan.popular ? plan.color + "60" : "rgba(255,255,255,0.08)",
                  boxShadow: plan.popular ? `0 0 60px ${plan.glow}` : "none",
                }}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div
                    className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5 shadow-lg shadow-violet-500/20"
                    style={{ background: `linear-gradient(135deg, ${plan.color}, #4F46E5)` }}
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
                  <p className="text-gray-500 text-sm">{plan.tagline}</p>
                </div>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-end gap-1">
                    <span className="text-5xl font-black text-white transition-all duration-300">
                      ${(annual ? plan.annualPrice : plan.monthlyPrice).toLocaleString()}
                    </span>
                    <span className="text-gray-500 mb-2 text-sm">
                      {plan.currency ? `${plan.currency} ` : (isEs ? "MXN " : "USD ")}{t.pricing.perMonth}
                    </span>
                  </div>
                  {annual && plan.monthlyPrice > plan.annualPrice && (
                    <p className="text-green-400 text-xs font-semibold mt-1">
                      {t.pricing.billedAnnually}{((plan.monthlyPrice - plan.annualPrice) * 12).toLocaleString()} {plan.currency}{t.pricing.savePerYear}
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
                      <span className="text-gray-400 text-sm">{feature}</span>
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
                          background: `linear-gradient(135deg, ${plan.color}, #4F46E5)`,
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

          <p className="text-center text-gray-600 text-sm mt-10">
            {t.pricing.finePrint}
          </p>
        </div>
      </section>

      {showModal && (
        <OnboardingModal
          onClose={() => setShowModal(false)}
          initialPlan={selectedPlan}
          initialBillingInterval={annual ? "annual" : "monthly"}
        />
      )}
    </>
  );
}
