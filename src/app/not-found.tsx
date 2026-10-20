// src/app/not-found.tsx
import Image from "next/image";
import Link from "next/link";
import { getTranslationServer } from "@/i18n/server";

export function generateMetadata() {
  const t = getTranslationServer();
  return {
    title: t.notFound.metaTitle,
    description: t.notFound.metaDescription,
  };
}

export default function NotFound() {
  const t = getTranslationServer();

  return (
    <main className="mk-page relative flex flex-col items-center justify-center overflow-hidden">
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
        style={{ background: "radial-gradient(circle, var(--mk-violet), transparent 70%)" }}
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15 blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(circle, var(--mk-cyan), transparent 70%)", animation: "pulse 6s ease-in-out infinite 2s" }}
      />

      {/* Floating particles */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className={`absolute rounded-full pointer-events-none ${i % 2 === 0 ? "bg-mk-violet" : "bg-mk-cyan"}`}
          style={{
            width: `${2 + (i % 3)}px`,
            height: `${2 + (i % 3)}px`,
            left: `${10 + i * 11}%`,
            top: `${20 + (i * 13) % 60}%`,
            opacity: 0.4 + (i % 3) * 0.15,
            animation: `float ${4 + (i % 3)}s ease-in-out infinite ${i * 0.6}s`,
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">
        {/* Mascot */}
        <div className="mb-8 relative" style={{ animation: "mascotFloat 4s ease-in-out infinite" }}>
          <div
            className="absolute inset-0 rounded-full opacity-40 blur-[40px]"
            style={{ background: "radial-gradient(circle, var(--mk-violet), transparent 70%)" }}
          />
          <Image
            src="/newaigent-mascot.png"
            alt={t.notFound.mascotAlt}
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
        <div className="mk-text-gradient text-[8rem] sm:text-[12rem] font-black leading-none tracking-tighter select-none">
          404
        </div>

        {/* Glassy card */}
        <div className="mt-4 mb-8 px-8 py-6 rounded-3xl border border-white/10 backdrop-blur-xl max-w-lg bg-white/[0.03]">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">{t.notFound.title}</h1>
          <p className="text-white/60 text-base sm:text-lg leading-relaxed">{t.notFound.description}</p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link href="/" className="mk-btn-primary px-8 py-4 rounded-2xl text-base font-bold hover:shadow-[0_0_30px_rgba(124,58,237,0.5)]">
            {t.notFound.backHome}
          </Link>
          <Link
            href="mailto:info@newaigent.com"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-0.5 backdrop-blur-sm"
          >
            {t.notFound.contactSupport}
          </Link>
        </div>

        {/* Bottom brand */}
        <div className="mt-16 flex items-center gap-3 opacity-40">
          <Image src="/newaigent-logo.png" alt="NewAigent" width={24} height={24} style={{ filter: "brightness(0) invert(1)" }} />
          <span className="text-white text-xs font-semibold tracking-widest uppercase">NewAigent</span>
        </div>
      </div>
    </main>
  );
}
