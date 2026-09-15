"use client";
// src/components/marketing/HowItWorksSection.tsx
import { useTranslation } from "@/i18n";
import { Rocket, Bot, Zap, ArrowRight } from "lucide-react";

export default function HowItWorksSection() {
  const { t } = useTranslation();

  const steps = [
    {
      number: "01",
      title: t.howItWorks.step1Title,
      description: t.howItWorks.step1Desc,
      icon: <Rocket className="w-7 h-7 text-violet-400" />,
      color: "#7C3AED",
    },
    {
      number: "02",
      title: t.howItWorks.step2Title,
      description: t.howItWorks.step2Desc,
      icon: <Bot className="w-7 h-7 text-cyan-400" />,
      color: "#06B6D4",
    },
    {
      number: "03",
      title: t.howItWorks.step3Title,
      description: t.howItWorks.step3Desc,
      icon: <Zap className="w-7 h-7 text-indigo-400" />,
      color: "#4F46E5",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="relative py-28 overflow-hidden"
      style={{ background: "#0a0a14" }}
    >
      {/* Top & bottom borders */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(6,182,212,0.5), transparent)" }} />
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)" }} />

      {/* Background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-10 blur-[100px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, #4F46E5, transparent 70%)" }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 mb-6">
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-widest">{t.howItWorks.badge}</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 tracking-tight">
            {t.howItWorks.headline1}{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #06B6D4 0%, #7C3AED 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {t.howItWorks.headline2}
            </span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            {t.howItWorks.subtitle}
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div
              key={step.number}
              id={`step-${step.number}`}
              className="relative overflow-hidden rounded-3xl p-8 sm:p-9 border transition-all duration-300 hover:-translate-y-2 group"
              style={{
                background: "linear-gradient(180deg, rgba(17, 17, 34, 0.75) 0%, rgba(9, 9, 20, 0.9) 100%)",
                borderColor: `${step.color}30`,
                boxShadow: `0 10px 40px -10px ${step.color}15`,
              }}
            >
              {/* Huge Background Watermark Number */}
              <span
                className="absolute -top-3 -right-2 text-8xl sm:text-9xl font-black select-none pointer-events-none tracking-tighter transition-all duration-500 group-hover:scale-105 group-hover:opacity-20"
                style={{
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  color: step.color,
                  opacity: 0.12,
                  lineHeight: 0.85,
                }}
                aria-hidden="true"
              >
                {step.number}
              </span>

              {/* Ambient radial blur at top corner */}
              <div
                className="absolute -top-10 -right-10 w-44 h-44 rounded-full blur-[70px] pointer-events-none transition-opacity duration-500 opacity-20 group-hover:opacity-40"
                style={{ background: step.color }}
              />

              {/* Top Row: Glowing Icon + Subtle Step Badge */}
              <div className="relative z-10 flex items-center justify-between mb-8">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${step.color}35, ${step.color}12)`,
                    border: `1.5px solid ${step.color}50`,
                    boxShadow: `0 0 24px ${step.color}25`,
                  }}
                >
                  {step.icon}
                </div>

              </div>

              {/* Content */}
              <div className="relative z-10">
                <h3 className="text-white font-bold text-xl mb-3 leading-snug">
                  {step.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Bottom accent glow bar on hover */}
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `linear-gradient(90deg, transparent, ${step.color}, transparent)`,
                }}
              />
            </div>
          ))}
        </div>

        {/* Bottom CTA nudge */}
        <div className="text-center mt-16">
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 text-violet-400 font-semibold text-base hover:text-violet-300 transition-colors group"
          >
            <span>{t.howItWorks.bottomCta}</span>
            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
          </a>
        </div>
      </div>
    </section