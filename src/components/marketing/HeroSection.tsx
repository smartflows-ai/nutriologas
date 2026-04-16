"use client";
// src/components/marketing/HeroSection.tsx
import { useState, useEffect } from "react";
import Image from "next/image";

const agentTypes = [
  "Social Media Manager",
  "Sales Assistant",
  "Customer Support",
  "Content Creator",
  "Marketing Strategist",
  "Appointment Scheduler",
];

export default function HeroSection({ onWatchDemo }: { onWatchDemo: () => void }) {
  const [currentAgent, setCurrentAgent] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentAgent((prev) => (prev + 1) % agentTypes.length);
        setVisible(true);
      }, 400);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: "#07070f" }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(124,58,237,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,58,237,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Aurora orbs */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[700px] h-[700px] rounded-full opacity-20 blur-[120px] z-0 animate-pulse"
        style={{ background: "radial-gradient(circle, #7C3AED, transparent 70%)" }}
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-15 blur-[120px] z-0"
        style={{
          background: "radial-gradient(circle, #06B6D4, transparent 70%)",
          animation: "pulse 6s ease-in-out infinite 2s",
        }}
      />
      <div
        className="absolute top-[40%] left-[60%] w-[400px] h-[400px] rounded-full opacity-10 blur-[100px] z-0"
        style={{
          background: "radial-gradient(circle, #4F46E5, transparent 70%)",
          animation: "pulse 8s ease-in-out infinite 1s",
        }}
      />

      {/* Floating particles */}
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full z-0"
          style={{
            width: `${2 + (i % 3)}px`,
            height: `${2 + (i % 3)}px`,
            background: i % 3 === 0 ? "#7C3AED" : i % 3 === 1 ? "#06B6D4" : "#4F46E5",
            left: `${8 + i * 8}%`,
            top: `${15 + (i * 17) % 70}%`,
            opacity: 0.4 + (i % 4) * 0.15,
            animation: `float ${4 + (i % 4)}s ease-in-out infinite ${i * 0.5}s`,
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Text side */}
          <div className="flex-1 text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-violet-500/30 bg-violet-500/10 backdrop-blur-sm mb-8">
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-xs font-semibold text-violet-300 uppercase tracking-widest">
                AI-Powered Business Automation
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6">
              Your World of{" "}
              <span
                className="block"
                style={{
                  background: "linear-gradient(135deg, #A78BFA 0%, #60A5FA 50%, #06B6D4 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                AI Agents
              </span>
            </h1>

            {/* Typing agent */}
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-8">
              <span className="text-gray-500 text-lg font-medium">Meet your AI</span>
              <div
                className="px-4 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10"
                style={{ minWidth: "220px" }}
              >
                <span
                  className="text-cyan-300 font-bold text-lg transition-all duration-300"
                  style={{ opacity: visible ? 1 : 0 }}
                >
                  {agentTypes[currentAgent]}
                </span>
              </div>
            </div>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-gray-400 leading-relaxed mb-10 max-w-xl mx-auto lg:mx-0">
              NeoAigent gives your business a{" "}
              <span className="text-white font-semibold">personal army of AI agents</span> — automating tasks,
              growing revenue, and freeing your team to focus on what{" "}
              <span className="text-violet-300 font-semibold">humans do best</span>.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <a
                id="hero-get-started"
                href="#pricing"
                className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-bold text-white overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
                }}
              >
                <span className="relative z-10">Get Started Free</span>
                <span className="relative z-10 transition-transform duration-200 group-hover:translate-x-1">→</span>
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </a>

              <button
                id="hero-watch-demo"
                onClick={onWatchDemo}
                className="group inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold text-white border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-0.5 backdrop-blur-sm"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 group-hover:bg-violet-500/30 transition-all duration-300">
                  <svg className="w-3 h-3 fill-white ml-0.5" viewBox="0 0 12 14">
                    <path d="M1 1l10 6L1 13V1z" />
                  </svg>
                </span>
                Watch Demo
              </button>
            </div>

            {/* Trust badges */}
            <div className="flex items-center justify-center lg:justify-start gap-6 mt-10">
              {[
                { icon: "⚡", label: "Setup in 2 min" },
                { icon: "🔒", label: "SOC2 Secure" },
                { icon: "🤖", label: "10+ AI Agents" },
              ].map((badge) => (
                <div key={badge.label} className="flex items-center gap-2">
                  <span className="text-base">{badge.icon}</span>
                  <span className="text-xs text-gray-500 font-medium">{badge.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mascot side */}
          <div className="flex-1 flex items-center justify-center relative">
            {/* Glow ring */}
            <div
              className="absolute w-80 h-80 rounded-full opacity-30 animate-spin"
              style={{
                background: "conic-gradient(from 0deg, #7C3AED, #4F46E5, #06B6D4, #7C3AED)",
                filter: "blur(40px)",
                animationDuration: "8s",
              }}
            />
            {/* Mascot */}
            <div
              className="relative z-10"
              style={{ animation: "mascotFloat 4s ease-in-out infinite" }}
            >
              <Image
                src="/newaigent-mascot.png"
                alt="NeoAigent AI mascot"
                width={380}
                height={380}
                className="drop-shadow-[0_0_60px_rgba(124,58,237,0.4)]"
                priority
                style={{
                  filter: "brightness(0) invert(1) drop-shadow(0 0 30px rgba(124,58,237,0.6))",
                }}
              />
            </div>
            {/* Floating agent cards */}
            <div
              className="absolute top-4 -left-4 bg-[#12121e]/80 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 shadow-xl"
              style={{ animation: "float 3s ease-in-out infinite" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-lg">✓</span>
                <div>
                  <p className="text-white text-xs font-semibold">Post published!</p>
                  <p className="text-gray-500 text-[10px]">AI Social Agent</p>
                </div>
              </div>
            </div>
            <div
              className="absolute bottom-8 -right-4 bg-[#12121e]/80 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 shadow-xl"
              style={{ animation: "float 4s ease-in-out infinite 1.5s" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 text-lg">📈</span>
                <div>
                  <p className="text-white text-xs font-semibold">+34% revenue</p>
                  <p className="text-gray-500 text-[10px]">This month</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <span className="text-gray-500 text-xs uppercase tracking-widest">Scroll</span>
          <div className="w-px h-10 bg-gradient-to-b from-gray-500 to-transparent" />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes mascotFloat {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-16px) rotate(1deg); }
        }
      ` }} />
    </section>
  );
}
