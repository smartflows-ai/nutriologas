"use client";
// src/components/marketing/FeaturesSection.tsx
import { useState } from "react";

const features = [
  {
    id: "social",
    icon: "📣",
    title: "Social Media AI Agent",
    description:
      "Automatically creates, schedules, and publishes posts to Facebook & Instagram with AI-generated copy and images tailored to your brand.",
    color: "#7C3AED",
    glow: "rgba(124,58,237,0.2)",
    tag: "Most Popular",
  },
  {
    id: "sales",
    icon: "💬",
    title: "WhatsApp Sales Agent",
    description:
      "Converts leads into buyers automatically via WhatsApp. Answers questions, shares products, and closes deals while you sleep.",
    color: "#25D366",
    glow: "rgba(37,211,102,0.2)",
    tag: null,
  },
  {
    id: "catalog",
    icon: "📦",
    title: "Smart Product Catalog",
    description:
      "AI-powered storefront that learns what sells. Dynamic pricing suggestions, inventory alerts, and SEO-optimized product descriptions.",
    color: "#06B6D4",
    glow: "rgba(6,182,212,0.2)",
    tag: null,
  },
  {
    id: "crm",
    icon: "📊",
    title: "Business Analytics",
    description:
      "Real-time dashboards with AI insights. Know which campaigns work, which products fly off the shelf, and where to invest next.",
    color: "#F59E0B",
    glow: "rgba(245,158,11,0.2)",
    tag: null,
  },
  {
    id: "multitenant",
    icon: "🏢",
    title: "White-Label Multi-Tenant",
    description:
      "Each business gets their own branded subdomain with custom colors, fonts, and identity. Your brand, powered by NeoAigent.",
    color: "#4F46E5",
    glow: "rgba(79,70,229,0.2)",
    tag: "Enterprise",
  },
  {
    id: "appointments",
    icon: "📅",
    title: "Appointment Scheduler",
    description:
      "AI agent that manages your calendar, sends reminders, and reduces no-shows. Sync with Google Calendar automatically.",
    color: "#EC4899",
    glow: "rgba(236,72,153,0.2)",
    tag: null,
  },
];

export default function FeaturesSection() {
  const [hovered, setHovered] = useState<string | null>(null);

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
            <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">Supercharger Features</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 tracking-tight">
            Every agent you need,{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #A78BFA 0%, #06B6D4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              ready to work
            </span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            NeoAigent brings enterprise-grade AI automation to every business — no coding, no complexity,
            just results from day one.
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
                Learn more <span>→</span>
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
