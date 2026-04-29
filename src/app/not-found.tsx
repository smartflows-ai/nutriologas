// src/app/not-found.tsx
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "404 — Page Not Found | NeoAigent",
  description: "This page doesn't exist. Let our AI agents guide you back.",
};

export default function NotFound() {
  return (
    <main
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "#07070f" }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Aurora orbs */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] pointer-events-none animate-pulse"
        style={{ background: "radial-gradient(circle, #7C3AED, transparent 70%)" }}
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15 blur-[120px] pointer-events-none"
        style={{
          background: "radial-gradient(circle, #06B6D4, transparent 70%)",
          animation: "pulse 6s ease-in-out infinite 2s",
        }}
      />

      {/* Floating particles */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: `${2 + (i % 3)}px`,
            height: `${2 + (i % 3)}px`,
            background: i % 2 === 0 ? "#7C3AED" : "#06B6D4",
            left: `${10 + i * 11}%`,
            top: `${20 + (i * 13) % 60}%`,
            opacity: 0.4 + (i % 3) * 0.15,
            animation: `float ${4 + (i % 3)}s ease-in-out infinite ${i * 0.6}s`,
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">

        {/* Logo */}
        <div
          className="mb-8 relative"
          style={{ animation: "mascotFloat 4s ease-in-out infinite" }}
        >
          {/* Glow ring behind mascot */}
          <div
            className="absolute inset-0 rounded-full opacity-40 blur-[40px]"
            style={{ background: "radial-gradient(circle, #7C3AED, transparent 70%)" }}
          />
          <Image
            src="/newaigent-mascot.png"
            alt="NeoAigent mascot"
            width={140}
            height={140}
            priority
            style={{
              filter: "brightness(0) invert(1) drop-shadow(0 0 30px rgba(124,58,237,0.7))",
              position: "relative",
            }}
          />
        </div>

        {/* 404 Number */}
        <div
          className="text-[8rem] sm:text-[12rem] font-black leading-none tracking-tighter select-none"
          style={{
            background: "linear-gradient(135deg, #A78BFA 0%, #60A5FA 50%, #06B6D4 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textShadow: "none",
          }}
        >
          404
        </div>

        {/* Glassy card */}
        <div
          className="mt-4 mb-8 px-8 py-6 rounded-3xl border border-white/10 backdrop-blur-xl max-w-lg"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            This page got lost in the matrix
          </h1>
          <p className="text-gray-400 text-base sm:text-lg leading-relaxed">
            Our AI agents searched every corner of the multiverse, but this URL
            doesn't exist. Let's get you back on track.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/"
            className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-bold text-white overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
          >
            <span>← Back to Home</span>
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </Link>

          <Link
            href="mailto:info@newaigent.com"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-0.5 backdrop-blur-sm"
          >
            Contact Support
          </Link>
        </div>

        {/* Bottom brand */}
        <div className="mt-16 flex items-center gap-3 opacity-40">
          <Image
            src="/newaigent-logo.png"
            alt="NeoAigent"
            width={24}
            height={24}
            style={{ filter: "brightness(0) invert(1)" }}
          />
          <span className="text-white text-xs font-semibold tracking-widest uppercase">
            NeoAigent
          </span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-12px); }
          }
          @keyframes mascotFloat {
            0%, 100% { transform: translateY(0px) rotate(-1deg); }
            50% { transform: translateY(-14px) rotate(1deg); }
          }
        `,
      }} />
    </main>
  );
}
