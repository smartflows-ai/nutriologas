"use client";
// src/components/marketing/CTASection.tsx
import { useState } from "react";
import Image from "next/image";
import OnboardingModal from "./OnboardingModal";

export default function CTASection() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <section
        id="contact"
        className="relative py-28 overflow-hidden"
        style={{ background: "#07070f" }}
      >
        {/* Background gradient */}
        <div
          className="absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(124,58,237,0.15) 0%, transparent 70%)",
          }}
        />
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)" }} />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Mascot floating above */}
          <div
            className="flex justify-center mb-8"
            style={{ animation: "mascotFloat 4s ease-in-out infinite" }}
          >
            <Image
              src="/newaigent-mascot.png"
              alt="NeoAigent mascot"
              width={100}
              height={100}
              className="opacity-90"
              style={{
                filter: "brightness(0) invert(1) drop-shadow(0 0 20px rgba(124,58,237,0.6))",
              }}
            />
          </div>

          <h2 className="text-4xl sm:text-6xl font-black text-white mb-6 leading-tight tracking-tight">
            Your AI agents are{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #A78BFA 0%, #06B6D4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              waiting for you
            </span>
          </h2>

          <p className="text-gray-400 text-lg mb-12 max-w-xl mx-auto leading-relaxed">
            Start your 14-day free trial. No credit card. No engineers.
            Your business, automated.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              id="cta-get-started"
              onClick={() => setShowModal(true)}
              className="px-10 py-5 rounded-2xl font-black text-lg text-white transition-all duration-300 hover:shadow-[0_0_40px_rgba(124,58,237,0.5)] hover:-translate-y-1 active:translate-y-0"
              style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
            >
              Launch My AI Agents →
            </button>
            <a
              href="mailto:info@newaigent.com"
              className="px-10 py-5 rounded-2xl font-bold text-lg text-gray-300 hover:text-white border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/8 transition-all duration-300"
            >
              Talk to Sales
            </a>
          </div>

          <p className="text-gray-600 text-sm mt-6">
            14-day free trial · No credit card required · Cancel anytime
          </p>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes mascotFloat {
            0%, 100% { transform: translateY(0px) rotate(-1deg); }
            50% { transform: translateY(-12px) rotate(1deg); }
          }
        ` }} />
      </section>

      {showModal && <OnboardingModal onClose={() => setShowModal(false)} />}
    </>
  );
}
