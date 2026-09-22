// src/components/legal/LegalPageLayout.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "@/i18n";
import { LegalDocument } from "./legalContent";
import {
  ShieldCheck,
  FileText,
  ArrowLeft,
  Printer,
  Copy,
  Check,
  ChevronRight,
  ArrowUp,
  Info,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Sparkles,
} from "lucide-react";
import MarketingFooter from "../marketing/MarketingFooter";

interface LegalPageLayoutProps {
  document: LegalDocument;
  activeDoc: "privacy" | "terms";
  isRootDomain: boolean;
  tenantName?: string;
  tenantLogoUrl?: string | null;
}

export default function LegalPageLayout({
  document,
  activeDoc,
  isRootDomain,
  tenantName,
  tenantLogoUrl,
}: LegalPageLayoutProps) {
  const { lang, t } = useTranslation();
  const [activeSection, setActiveSection] = useState<string>(document.sections[0]?.id || "");
  const [copied, setCopied] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Scroll spy & reading progress
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = window.document.documentElement.scrollHeight - window.innerHeight;
      const progress = totalHeight > 0 ? (window.scrollY / totalHeight) * 100 : 0;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
      setShowBackToTop(window.scrollY > 400);

      // Detect active section
      const sectionElements = document.sections.map((s) => ({
        id: s.id,
        el: window.document.getElementById(s.id),
      }));

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const item = sectionElements[i];
        if (item.el) {
          const rect = item.el.getBoundingClientRect();
          if (rect.top <= 180) {
            setActiveSection(item.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [document.sections]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div
      className="min-h-screen text-slate-100 selection:bg-violet-500/30 selection:text-white"
      style={{
        background: "#07070f",
        fontFamily: "'Inter', 'Space Grotesk', system-ui, sans-serif",
      }}
    >
      {/* Reading Progress Bar (Fixed Top) */}
      <div className="fixed top-0 left-0 right-0 h-1 z-[60] bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Ambient background glows */}
      <div
        className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-15 blur-[140px] pointer-events-none z-0"
        style={{ background: "radial-gradient(circle, #7C3AED 0%, transparent 70%)" }}
      />
      <div
        className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-10 blur-[140px] pointer-events-none z-0"
        style={{ background: "radial-gradient(circle, #06B6D4 0%, transparent 70%)" }}
      />

      {/* Top Header / Navigation */}
      <header className="sticky top-0 z-50 bg-[#07070f]/80 backdrop-blur-xl border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between gap-4">
          {/* Brand & Back Button */}
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200 group"
              title={lang === "es" ? "Volver al inicio" : "Back to Home"}
            >
              <ArrowLeft size={14} className="transition-transform duration-200 group-hover:-translate-x-1" />
              <span className="hidden sm:inline">{lang === "es" ? "Inicio" : "Home"}</span>
            </Link>

            <Link href="/" className="flex items-center gap-3 group">
              {tenantLogoUrl ? (
                <img
                  src={tenantLogoUrl}
                  alt={tenantName || "Store"}
                  className="w-9 h-9 object-contain rounded-xl border border-white/10"
                />
              ) : (
                <div className="relative w-8 h-8 sm:w-9 sm:h-9">
                  <Image
                    src="/newaigent-mascot.png"
                    alt="NewAigent mascot"
                    fill
                    className="object-contain drop-shadow-[0_0_20px_rgba(124,58,237,0.4)]"
                    style={{ filter: "brightness(0) invert(1) drop-shadow(0 0 10px rgba(124,58,237,0.6))" }}
                  />
                </div>
              )}
              <span className="font-bold text-lg sm:text-xl text-white tracking-tight">
                {tenantName ? (
                  tenantName
                ) : (
                  <>
                    New<span className="text-violet-400">Aigent</span>
                  </>
                )}
              </span>
            </Link>
          </div>

          {/* Document Switcher Tabs */}
          <div className="hidden md:flex items-center p-1 rounded-2xl bg-white/5 border border-white/10 shadow-inner">
            <Link
              href="/privacy"
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeDoc === "privacy"
                  ? "bg-violet-600 text-white shadow-[0_2px_12px_rgba(124,58,237,0.4)]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <ShieldCheck size={14} />
              {lang === "es" ? "Privacidad" : "Privacy Policy"}
            </Link>
            <Link
              href="/terms"
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeDoc === "terms"
                  ? "bg-violet-600 text-white shadow-[0_2px_12px_rgba(124,58,237,0.4)]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <FileText size={14} />
              {lang === "es" ? "Términos" : "Terms of Service"}
            </Link>
          </div>

          {/* Quick Actions (Print / Copy Link) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200"
              title={lang === "es" ? "Copiar enlace al portapapeles" : "Copy link to clipboard"}
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-300 hidden sm:inline">{lang === "es" ? "Copiado" : "Copied"}</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span className="hidden sm:inline">{lang === "es" ? "Compartir" : "Share"}</span>
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200"
              title={lang === "es" ? "Imprimir documento" : "Print document"}
            >
              <Printer size={14} />
              <span className="hidden sm:inline">{lang === "es" ? "Imprimir" : "Print"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Document Hero Banner */}
        <div className="mb-12 lg:mb-16 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 mb-4 shadow-[0_0_20px_rgba(124,58,237,0.15)]">
            <Sparkles size={14} className="text-violet-400" />
            <span className="text-xs font-bold text-violet-300 tracking-wide uppercase">
              {document.badge}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4 leading-tight">
            {document.title}
          </h1>

          <p className="text-gray-400 text-base sm:text-lg mb-6 leading-relaxed">
            {document.subtitle}
          </p>

          <div className="inline-flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500 font-medium">
            <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10">
              {lang === "es" ? "Última actualización:" : "Last updated:"}{" "}
              <strong className="text-gray-300">{document.lastUpdated}</strong>
            </span>
            <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10">
              {lang === "es" ? "Fecha efectiva:" : "Effective date:"}{" "}
              <strong className="text-gray-300">{document.effectiveDate}</strong>
            </span>
          </div>

          {/* Executive Summary Card */}
          <div className="mt-8 p-5 sm:p-6 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-950/30 via-[#0e0e20] to-indigo-950/30 text-left shadow-lg">
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-violet-500/20 text-violet-300 shrink-0 mt-0.5">
                <Info size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">
                  {lang === "es" ? "Resumen Ejecutivo de Privacidad y Cumplimiento" : "Executive Privacy & Compliance Summary"}
                </h4>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                  {document.summary}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Switcher (Visible on small screens) */}
        <div className="flex md:hidden items-center justify-center gap-2 mb-8 p-1.5 rounded-2xl bg-white/5 border border-white/10">
          <Link
            href="/privacy"
            className={`flex-1 py-2 rounded-xl text-xs font-bold text-center transition-all ${
              activeDoc === "privacy" ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {lang === "es" ? "Política de Privacidad" : "Privacy Policy"}
          </Link>
          <Link
            href="/terms"
            className={`flex-1 py-2 rounded-xl text-xs font-bold text-center transition-all ${
              activeDoc === "terms" ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {lang === "es" ? "Términos de Servicio" : "Terms of Service"}
          </Link>
        </div>

        {/* Two-Column Grid: TOC + Document Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Sticky Table of Contents (Desktop) */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-28 self-start">
            <div className="p-6 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl shadow-xl">
              <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Lock size={14} />
                {lang === "es" ? "Contenido del Documento" : "Table of Contents"}
              </h3>

              <nav className="space-y-1">
                {document.sections.map((section) => {
                  const isActive = activeSection === section.id;
                  return (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                        isActive
                          ? "bg-violet-500/15 text-violet-300 border border-violet-500/30 font-semibold"
                          : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                      }`}
                    >
                      <span className="truncate pr-2">{section.title}</span>
                      <ChevronRight
                        size={12}
                        className={`transition-transform duration-200 ${
                          isActive ? "text-violet-400 translate-x-0.5" : "text-gray-600 group-hover:text-gray-400"
                        }`}
                      />
                    </a>
                  );
                })}
              </nav>

              {/* Quick Switch Card */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-[11px] text-gray-500 mb-2">
                  {lang === "es" ? "Documento relacionado:" : "Related document:"}
                </p>
                <Link
                  href={activeDoc === "privacy" ? "/terms" : "/privacy"}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-violet-500/30 transition-all text-xs text-gray-200 group"
                >
                  <span className="font-semibold">
                    {activeDoc === "privacy"
                      ? lang === "es"
                        ? "Ver Términos de Servicio"
                        : "View Terms of Service"
                      : lang === "es"
                      ? "Ver Política de Privacidad"
                      : "View Privacy Policy"}
                  </span>
                  <ChevronRight size={14} className="text-violet-400 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </aside>

          {/* Right Column: Legal Document Sections */}
          <div className="lg:col-span-8 space-y-8">
            {document.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-28 p-6 sm:p-8 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl shadow-md transition-all duration-300 hover:border-white/20"
              >
                {/* Section Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {section.title}
                  </h2>
                  {section.badge && (
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white/5 border border-white/10 text-gray-400">
                      {section.badge}
                    </span>
                  )}
                </div>

                {/* Section Paragraphs */}
                <div className="space-y-4 text-sm sm:text-base text-gray-300 leading-relaxed">
                  {section.content.map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>

                {/* Bullet Points */}
                {section.bulletPoints && section.bulletPoints.length > 0 && (
                  <ul className="mt-4 space-y-2.5">
                    {section.bulletPoints.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-gray-300 leading-relaxed">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Callout Box */}
                {section.callout && (
                  <div
                    className={`mt-6 p-4 sm:p-5 rounded-2xl border text-xs sm:text-sm leading-relaxed ${
                      section.callout.type === "success"
                        ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                        : section.callout.type === "warning"
                        ? "bg-amber-950/20 border-amber-500/30 text-amber-200"
                        : "bg-blue-950/20 border-blue-500/30 text-blue-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        {section.callout.type === "success" ? (
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        ) : section.callout.type === "warning" ? (
                          <AlertTriangle size={16} className="text-amber-400" />
                        ) : (
                          <ShieldCheck size={16} className="text-blue-400" />
                        )}
                      </div>
                      <div>
                        <strong className="block font-semibold mb-1 text-white">
                          {section.callout.title}
                        </strong>
                        <p className="text-gray-300">{section.callout.text}</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            ))}

            {/* Bottom Card: Switch to the other document */}
            <div className="p-8 rounded-3xl border border-violet-500/20 bg-gradient-to-r from-violet-950/20 via-[#0d0d1a] to-indigo-950/20 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">
                  {activeDoc === "privacy"
                    ? lang === "es"
                      ? "¿Deseas revisar nuestros Términos de Servicio?"
                      : "Looking for our Terms of Service?"
                    : lang === "es"
                    ? "¿Deseas revisar nuestra Política de Privacidad?"
                    : "Looking for our Privacy Policy?"}
                </h3>
                <p className="text-sm text-gray-400 max-w-md">
                  {activeDoc === "privacy"
                    ? lang === "es"
                      ? "Conoce las condiciones contractuales, uso del software, pasarelas de pago y soporte."
                      : "Review our contractual agreements, software licenses, payment policies, and SLA commitments."
                    : lang === "es"
                    ? "Conoce cómo protegemos tus datos, el aislamiento multi-tenant y las garantías de Newy AI."
                    : "Discover how we protect your data, maintain multi-tenant boundaries, and protect your privacy."}
                </p>
              </div>

              <Link
                href={activeDoc === "privacy" ? "/terms" : "/privacy"}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm shadow-[0_4px_20px_rgba(124,58,237,0.4)] transition-all shrink-0 hover:scale-105"
              >
                <span>
                  {activeDoc === "privacy"
                    ? lang === "es"
                      ? "Leer Términos"
                      : "Read Terms"
                    : lang === "es"
                    ? "Leer Privacidad"
                    : "Read Privacy"}
                </span>
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-violet-600 hover:bg-violet-500 text-white shadow-[0_4px_20px_rgba(124,58,237,0.5)] border border-white/20 transition-all hover:scale-110"
          aria-label={lang === "es" ? "Volver arriba" : "Back to top"}
        >
          <ArrowUp size={18} />
        </button>
      )}

      {/* Root Domain Marketing Footer */}
      {isRootDomain && <MarketingFooter />}
    </div>
  );
}
