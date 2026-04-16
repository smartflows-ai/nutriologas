"use client";
// src/components/marketing/PricingSection.tsx
import { useState } from "react";

const plans = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For solo entrepreneurs",
    monthlyPrice: 29,
    annualPrice: 19,
    color: "#06B6D4",
    glow: "rgba(6,182,212,0.15)",
    popular: false,
    features: [
      "1 AI-powered subdomain",
      "Social Media Agent (Facebook & IG)",
      "Product catalog (up to 50 products)",
      "WhatsApp integration",
      "Basic analytics dashboard",
      "Email support",
    ],
    cta: "Start Free Trial",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For growing businesses",
    monthlyPrice: 79,
    annualPrice: 59,
    color: "#7C3AED",
    glow: "rgba(124,58,237,0.2)",
    popular: true,
    features: [
      "Everything in Starter",
      "Unlimited products",
      "Appointment Scheduler Agent",
      "Advanced analytics + AI insights",
      "Custom branding (colors & fonts)",
      "Priority support",
      "n8n workflow automation",
      "Google Calendar sync",
    ],
    cta: "Start Free Trial",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For agencies & large teams",
    monthlyPrice: 199,
    annualPrice: 149,
    color: "#4F46E5",
    glow: "rgba(79,70,229,0.15)",
    popular: false,
    features: [
      "Everything in Pro",
      "Unlimited subdomains / tenants",
      "Custom AI agent development",
      "White-label (remove NeoAigent branding)",
      "Dedicated account manager",
      "SLA uptime guarantee",
      "SSO & advanced permissions",
      "On-premise deployment option",
    ],
    cta: "Contact Sales",
  },
];

export default function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
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
              Simple Pricing
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 tracking-tight">
            Invest in AI,{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #A78BFA 0%, #06B6D4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              get back time
            </span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto mb-10">
            14-day free trial on all plans. No credit card required.
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
              Monthly
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
              Annual
              <span className="ml-2 text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full border border-green-500/30">
                Save 25%
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
                  className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider text-white"
                  style={{ background: `linear-gradient(135deg, ${plan.color}, #4F46E5)` }}
                >
                  ⭐ Most Popular
                </div>
              )}

              {/* Plan name & tagline */}
              <div className="mb-6">
                <h3
                  className="text-xl font-black mb-1"
                  style={{ color: plan.color }}
                >
                  {plan.name}
                </h3>
                <p className="text-gray-500 text-sm">{plan.tagline}</p>
              </div>

              {/* Price */}
              <div className="mb-8">
                <div className="flex items-end gap-1">
                  <span
                    className="text-5xl font-black text-white transition-all duration-300"
                  >
                    ${annual ? plan.annualPrice : plan.monthlyPrice}
                  </span>
                  <span className="text-gray-500 mb-2 text-sm">/mo</span>
                </div>
                {annual && (
                  <p className="text-green-400 text-xs font-semibold mt-1">
                    Billed annually — save ${(plan.monthlyPrice - plan.annualPrice) * 12}/yr
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
                      style={{ background: plan.color + "20", color: plan.color }}
                    >
                      ✓
                    </span>
                    <span className="text-gray-400 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <a
                href="#contact"
                className="w-full text-center px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 hover:-translate-y-0.5"
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
              </a>
            </div>
          ))}
        </div>

        {/* Fine print */}
        <p className="text-center text-gray-600 text-sm mt-10">
          All plans include 14-day free trial · Cancel anytime · No hidden fees
        </p>
      </div>
    </section>
  );
}
