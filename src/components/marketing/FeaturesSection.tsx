"use client";
// src/components/marketing/FeaturesSection.tsx
import { useState } from "react";
import { useTranslation } from "@/i18n";

const features = [
  {
    id: "social",
    icon: "📣",
    title: "Social Media AI Agent",
    description:
      "Posts to Facebook & Instagram daily — copy, image, caption — all generated in your brand voice. Your followers grow while you're with clients.",
    color: "#7C3AED",
    glow: "rgba(124,58,237,0.2)",
    tag: "Most Popular",
  },
  {
    id: "sales",
    icon: "💬",
    title: "WhatsApp Sales Agent",
    description:
      "Responds instantly, sends product photos, answers objections, and takes orders. You get the sale notification. The agent did the work.",
    color: "#25D366",
    glow: "rgba(37,211,102,0.2)",
    tag: null,
  },
  {
    id: "catalog",
    icon: "📦",
    title: "Smart Product Catalog",
    description:
      "Your store stays current, SEO-optimized, and conversion-ready. The AI flags what's trending and what needs a push.",
    color: "#06B6D4",
    glow: "rgba(6,182,212,0.2)",
    tag: null,
  },
  {
    id: "crm",
    icon: "📊",
    title: "Business Analytics",
    description:
      "Stop guessing. Know exactly what's working — which posts drove sales, which agents converted most, where to invest next week.",
    color: "#F59E0B",
    glow: "rgba(245,158,11,0.2)",
    tag: null,
  },
  {
    id: "multitenant",
    icon: "🏢",
    title: "White-Label Multi-Tenant",
    description:
      "Your clients get their own branded store, their own agents, their own domain. You deliver the whole package under your name.",
    color: "#4F46E5",
    glow: "rgba(79,70,229,0.2)",
    tag: "Enterprise",
  },
  {
    id: "appointments",
    icon: "📅",
    title: "Appointment Scheduler",
    description:
      "Patients book themselves. Reminders go out automatically. No-shows drop. You just show up.",
    color: "#EC4899",
    glow: "rgba(236,72,153,0.2)",
    tag: null,
  },
];

export default function FeaturesSection() {
  const [hovered, setHovered] = useState<string | null>(null);
  const { t } = useTranslation();

  const features = [
    {
      id: "social",
      icon: "📣",
      title: t.features.social.title,
      description: t.features.social.description,
      color: "#7C3AED",
      glow: "rgba(124,58,237,0.2)",
      tag: t.features.social.tag,
    },
    {
      id: "sales",
      icon: "💬",
      title: t.features.sales.title,
      description: t.features.sales.description,
      color: "#25D366",
      glow: "rgba(37,211,102,0.2)",
      tag: null,
    },
    {
      id: "catalog",
      icon: "📦",
      title: t.features.catalog.title,
      description: t.features.catalog.description,
      color: "#06B6D4",
      glow: "rgba(6,182,212,0.2)",
      tag: null,
    },
    {
      id: "crm",
      icon: "📊",
      title: t.features.analytics.title,
      description: t.features.analytics.description,
      color: "#F59E0B",
      glow: "rgba(245,158,11,0.2)",
      tag: null,
    },
    {
      id: "multitenant",
      icon: "🏢",
      title: t.features.whiteLabel.title,
      description: t.features.whiteLabel.description,
      color: "#4F46E5",
      glow: "rgba(79,70,229,0.2)",
      tag: t.features.whiteLabel.tag,
    },
    {
      id: "appointments",
      icon: "📅",
      title: t.features.appointments.title,
      description: t.features.appointments.description,
      color: "#EC4899",
      glow: "rgba(236,72,153,0.2)",
      tag: null,
    },
  ];

  return (
    <section
      id="features"
      className="relative py-28 overflow-hidden"
      style={{ background: "#07070f" }}
    >
      {/* Subtle gradient top */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-violet-500/30 bg-violet-500/10 mb-6">
            <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">{t.features.badge}</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 tracking-tight">
            {t.features.headline1}{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #A78BFA 0%, #06B6D4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {t.features.headline2}
            </span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            {t.features.subtitle}
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.id}
              id={`feature-${feature.id}`}
              onMouseEnter={() => setHovered(feature.id)}
              onMouseLeave={() => setHovered(null)}
              className="relative group cursor-default rounded-2xl p-6 border transition-all duration-300"
              style={{
                background: hovered === feature.id
                  ? `radial-gradient(ellipse at top left, ${feature.glow} 0%, #0d0d1a 60%)`
                  : "#0d0d1a",
                borderColor: hovered === feature.id ? feature.color + "50" : "rgba(255,255,255,0.06)",
                transform: hovered === feature.id ? "translateY(-4px)" : "translateY(0)",
                boxShadow: hovered === feature.id ? `0 20px 40px ${feature.glow}` : "none",
              }}
            >
              {/* Optional tag */}
              {feature.tag && (
                <span
                  className="absolute top-4 right-4 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                  style={{
                    background: feature.color + "20",
                    color: feature.color,
                    border: `1px solid ${feature.color}40`,
                  }}
                >
                  {feature.tag}
                </span>
              )}

              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-5 transition-all duration-300"
                style={{
                  background: feature.color + "15",
                  border: `1px solid ${feature.color}30`,
                  boxShadow: hovered === feature.id ? `0 0 20px ${feature.glow}` : "none",
                }}
              >
                {feature.icon}
              </div>

              {/* Text */}
              <h3 className="text-white font-bold text-lg mb-3 leading-tight">{feature.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed group-hover:text-gray-400 transition-colors">
                {feature.description}
              </p>

              {/* Hover arrow */}
              <div
                className="flex items-center gap-1 mt-5 text-xs font-semibold transition-all duration-300"
                style={{
                  color: feature.color,
                  opacity: hovered === feature.id ? 1 : 0,
                  transform: hovered === feature.id ? "translateX(0)" : "translateX(-8px)",
                }}
              >
                {t.features.learnMore} <span>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom gradient */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(79,70,229,0.5), transparent)" }}
      />
    </section>
  );
}
