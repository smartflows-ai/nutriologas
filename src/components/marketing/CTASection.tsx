"use client";
// src/components/marketing/CTASection.tsx
import { useState } from "react";
import Image from "next/image";

export default function CTASection() {
  const [email, setEmail] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && subdomain) {
      setSubmitted(true);
    }
  };

  return (
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

        {!submitted ? (
          <form
            id="cta-signup-form"
            onSubmit={handleSubmit}
            className="bg-[#0d0d1a] border border-white/10 rounded-3xl p-8 sm:p-10 max-w-lg mx-auto shadow-[0_0_60px_rgba(124,58,237,0.1)]"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-left text-sm font-semibold text-gray-400 mb-2">
                  Work Email
                </label>
                <input
                  id="cta-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourbusiness.com"
                  className="w-full bg-[#12121e] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-left text-sm font-semibold text-gray-400 mb-2">
                  Choose Your Subdomain
                </label>
                <div className="flex items-center bg-[#12121e] border border-white/10 rounded-xl overflow-hidden focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 transition-all">
                  <input
                    id="cta-subdomain"
                    type="text"
                    required
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="yourbusiness"
                    className="flex-1 bg-transparent px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none"
                  />
                  <span className="px-4 text-gray-600 text-sm font-medium border-l border-white/10 bg-[#0d0d1a] py-3 whitespace-nowrap">
                    .newaigent.com
                  </span>
                </div>
              </div>

              <button
                id="cta-submit"
                type="submit"
                className="w-full py-4 rounded-xl font-black text-base text-white transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
              >
                Launch My AI Agents →
              </button>
            </div>

            <p className="text-gray-600 text-xs mt-4">
              14-day free trial · No credit card required · Cancel anytime
            </p>
          </form>
        ) : (
          <div className="bg-[#0d0d1a] border border-green-500/30 rounded-3xl p-10 max-w-lg mx-auto">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-2xl font-black text-white mb-3">
              Welcome to NeoAigent!
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              We're setting up{" "}
              <span className="text-violet-400 font-bold">{subdomain}.newaigent.com</span> for you.
              Check <span className="text-white font-semibold">{email}</span> for your login link.
            </p>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes mascotFloat {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-12px) rotate(1deg); }
        }
      ` }} />
    </section>
  );
}
