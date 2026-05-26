"use client";
// src/components/marketing/CTASection.tsx
import { useState } from "react";
import { useTranslation } from "@/i18n";
import Image from "next/image";
import OnboardingModal from "./OnboardingModal";

export default function CTASection() {
  const [showModal, setShowModal] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <section
        id="cta"
        className="relative py-32 overflow-hidden"
        style={{ background: "#0a0a14" }}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)" }} />

        {/* Dynamic Background Glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-full rounded-full opacity-20 blur-[120px] pointer-events-none"
          style={{ background: "radial-gradient(circle, #7C3AED, #06B6D4, transparent 70%)" }}
        />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="flex justify-center mb-8">
            <Image
              src="/newaigent-mascot.png"
              alt="NeoAigent"
              width={100}
              height={100}
              className="drop-shadow-[0_0_40px_rgba(124,58,237,0.5)] animate-bounce"
              style={{
                filter: "brightness(0) invert(1) drop-shadow(0 0 20px rgba(124,58,237,0.5))",
                animationDuration: "3s"
              }}
            />
          </div>

          <h2 className="text-4xl sm:text-6xl font-black text-white mb-6 leading-tight tracking-tight">
            {t.cta.headline1}{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #A78BFA 0%, #06B6D4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {t.cta.headline2}
            </span>
          </h2>

          <p className="text-gray-400 text-lg mb-12 max-w-xl mx-auto leading-relaxed">
            {t.cta.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              id="cta-get-started"
              onClick={() => setShowModal(true)}
              className="px-10 py-5 rounded-2xl font-black text-lg text-white transition-all duration-300 hover:shadow-[0_0_40px_rgba(124,58,237,0.5)] hover:-translate-y-1 active:translate-y-0"
              style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
            >
              {t.cta.button}
            </button>
            <a
              href="mailto:info@newaigent.com"
              className="px-10 py-5 rounded-2xl font-bold text-lg text-gray-300 hover:text-white border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/8 transition-all duration-300"
            >
              {t.cta.talkToSales}
            </a>
          </div>

          <p className="text-gray-600 text-sm mt-6">
            {t.cta.finePrint}
          </p>
        </div>
      </section>

      {/* Reusing the exact OnboardingModal that creates real DB tenants */}
      {showModal && <OnboardingModal onClose={() => setShowModal(false)} />}
    </>
  );
}
