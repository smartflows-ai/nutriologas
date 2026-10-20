"use client";
// src/components/marketing/FeaturesSection.tsx
import { useState } from "react";
import {
  Megaphone, MessageSquare, Package, BarChart2,
  Building2, Calendar, ArrowRight
} from "lucide-react";
import { useTranslation } from "@/i18n";

export default function FeaturesSection() {
  const [hovered, setHovered] = useState<string | null>(null);
  const { t } = useTranslation();

  const features = [
    {
      id: "social",
      icon: <Megaphone size={22} />,
      title: t.features.social.title,
      description: t.features.social.description,
      color: "var(--mk-violet)",
      glow: "rgba(124,58,237,0.2)",
      tag: t.features.social.tag,
    },
    {
      id: "sales",
      icon: <MessageSquare size={22} />,
      title: t.features.sales.title,
      description: t.features.sales.description,
      color: "#25D366",
      glow: "rgba(37,211,102,0.2)",
      tag: null,
    },
    {
      id: "catalog",
      icon: <Package size={22} />,
      title: t.features.catalog.title,
      description: t.features.catalog.description,
      color: "var(--mk-cyan)",
      glow: "rgba(6,182,212,0.2)",
      tag: null,
    },
    {
      id: "crm",
      icon: <BarChart2 size={22} />,
      title: t.features.analytics.title,
      description: t.features.analytics.description,
      color: "var(--mk-amber)",
      glow: "rgba(245,158,11,0.2)",
      tag: null,
    },
    {
      id: "multitenant",
      icon: <Building2 size={22} />,
      title: t.features.whiteLabel.title,
      description: t.features.whiteLabel.description,
      color: "var(--mk-indigo)",
      glow: "rgba(79,70,229,0.2)",
      tag: t.features.whiteLabel.tag,
    },
    {
      id: "appointments",
      icon: <Calendar size={22} />,
      title: t.features.appointments.title,
      description: t.features.appointments.description,
      color: "var(--mk-pink)",
      glow: "rgba(236,72,153,0.2)",
      tag: null,
    },
  ];

  return (
    <section
      id="features"
      className="relative py-28 overflow-hidden"
      style={{ background: "var(--mk-bg)" }}
    >
      {/* Subtle gradient top */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-mk-violet/30 bg-mk-violet/10 mb-6">
            <span className="text-xs font-bold text-mk-violet-light uppercase tracking-widest">{t.features.badge}</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 tracking-tight">
            {t.features.headline1}{" "}
            <span
              style={{
                background: "linear-gradient(135deg, var(--mk-violet-light) 0%, var(--mk-cyan) 100%)",
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
                  ? `radial-gradient(ellipse at top left, ${feature.glow} 0%, var(--mk-card) 60%)`
                  : "var(--mk-card)",
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
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300"
                style={{
                  background: feature.color + "15",
                  border: `1px solid ${feature.color}30`,
                  color: feature.color,
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
                {t.features.learnMore} <ArrowRight size={14} />
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
