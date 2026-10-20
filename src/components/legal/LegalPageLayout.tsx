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

// SaaS-global legal pages: always the NewAigent dark brand, never the tenant theme.
const tabBase = "inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200";
const tabActive = "bg-mk-violet text-white shadow-[0_2px_12px_rgba(124,58,237,0.4)]";
const tabIdle = "text-white/50 hover:text-white";
const quickButton = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200";
const ctaButton = "inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-mk-violet hover:bg-mk-violet/80 text-white font-bold text-sm shadow-[0_4px_20px_rgba(124,58,237,0.4)] transition-all shrink-0 hover:scale-105";

export default function LegalPageLayout({
  document,
  activeDoc,
  isRootDomain,
  tenantName,
  tenantLogoUrl,
}: LegalPageLayoutProps) {
  const { t } = useTranslation();
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

  const otherHref = activeDoc === "privacy" ? "/terms" : "/privacy";
  const otherCtaTitle = activeDoc === "privacy" ? t.legal.ctaTermsTitle : t.legal.ctaPrivacyTitle;
  const otherCtaDesc = activeDoc === "privacy" ? t.legal.ctaTermsDesc : t.legal.ctaPrivacyDesc;
  const otherCtaLabel = activeDoc === "privacy" ? t.legal.readTerms : t.legal.readPrivacy;
  const otherViewLabel = activeDoc === "privacy" ? t.legal.viewTerms : t.legal.viewPrivacy;

  return (
    <div
      className="mk-page selection:bg-mk-violet/30 selection:text-white"
      style={{ fontFamily: "'Inter', 'Space Grotesk', system-ui, sans-serif" }}
    >
      {/* Reading Progress Bar (Fixed Top) */}
      <div className="fixed top-0 left-0 right-0 h-1 z-[60] bg-white/5">
        <div
          className="h-full bg-mk-gradient transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Ambient background glows */}
      <div
        className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-15 blur-[140px] pointer-events-none z-0"
        style={{ background: "radial-gradient(circle, var(--mk-violet) 0%, transparent 70%)" }}
      />
      <div
        className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-10 blur-[140px] pointer-events-none z-0"
        style={{ background: "radial-gradient(circle, var(--mk-cyan) 0%, transparent 70%)" }}
      />

      {/* Top Header / Navigation */}
      <header className="sticky top-0 z-50 bg-mk-bg/80 backdrop-blur-xl border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between gap-4">
          {/* Brand & Back Button */}
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 group"
              title={t.legal.backHome}
              aria-label={t.legal.backHome}
            >
              <ArrowLeft size={14} className="transition-transform duration-200 group-hover:-translate-x-1" />
              <span className="hidden sm:inline">{t.legal.home}</span>
            </Link>

            <Link href="/" className="flex items-center gap-3 group">
              {tenantLogoUrl ? (
                <img
                  src={tenantLogoUrl}
                  alt={tenantName || "NewAigent"}
                  className="w-9 h-9 object-contain rounded-xl border border-white/10"
                />
              ) : (
                <div className="relative w-8 h-8 sm:w-9 sm:h-9">
                  <Image
                    src="/newaigent-mascot.png"
                    alt="NewAigent"
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
                    New<span className="text-mk-violet-light">Aigent</span>
                  </>
                )}
              </span>
            </Link>
          </div>

          {/* Document Switcher Tabs */}
          <div className="hidden md:flex items-center p-1 rounded-2xl bg-white/5 border border-white/10 shadow-inner">
            <Link href="/privacy" className={`${tabBase} ${activeDoc === "privacy" ? tabActive : tabIdle}`}>
              <ShieldCheck size={14} />
              {t.legal.privacyTab}
            </Link>
            <Link href="/terms" className={`${tabBase} ${activeDoc === "terms" ? tabActive : tabIdle}`}>
              <FileText size={14} />
              {t.legal.termsTab}
            </Link>
          </div>

          {/* Quick Actions (Print / Copy Link) */}
          <div className="flex items-center gap-2">
            <button onClick={handleCopyLink} className={quickButton} title={t.legal.copyLink} aria-label={t.legal.copyLink}>
              {copied ? (
                <>
                  <Check size={14} className="text-mk-emerald" />
                  <span className="text-mk-emerald hidden sm:inline">{t.legal.copied}</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span className="hidden sm:inline">{t.legal.share}</span>
                </>
              )}
            </button>

            <button onClick={handlePrint} className={quickButton} title={t.legal.printDocument} aria-label={t.legal.printDocument}>
              <Printer size={14} />
              <span className="hidden sm:inline">{t.legal.print}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Document Hero Banner */}
        <div className="mb-12 lg:mb-16 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-mk-violet/30 bg-mk-violet/10 mb-4 shadow-[0_0_20px_rgba(124,58,237,0.15)]">
            <Sparkles size={14} className="text-mk-violet-light" />
            <span className="text-xs font-bold text-mk-violet-light tracking-wide uppercase">
              {document.badge}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4 leading-tight">
            {document.title}
          </h1>

          <p className="text-white/60 text-base sm:text-lg mb-6 leading-relaxed">
            {document.subtitle}
          </p>

          <div className="inline-flex flex-wrap items-center justify-center gap-3 text-xs text-white/50 font-medium">
            <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10">
              {t.legal.lastUpdated}{" "}
              <strong className="text-white/80">{document.lastUpdated}</strong>
            </span>
            <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10">
              {t.legal.effectiveDate}{" "}
              <strong className="text-white/80">{document.effectiveDate}</strong>
            </span>
          </div>

          {/* Executive Summary Card */}
          <div className="mt-8 p-5 sm:p-6 rounded-2xl border border-mk-violet/20 bg-mk-card text-left shadow-lg">
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-mk-violet/20 text-mk-violet-light shrink-0 mt-0.5">
                <Info size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">{t.legal.executiveSummary}</h4>
                <p className="text-xs sm:text-sm text-white/70 leading-relaxed">{document.summary}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Switcher (Visible on small screens) */}
        <div className="flex md:hidden items-center justify-center gap-2 mb-8 p-1.5 rounded-2xl bg-white/5 border border-white/10">
          <Link
            href="/privacy"
            className={`flex-1 py-2 rounded-xl text-xs font-bold text-center transition-all ${
              activeDoc === "privacy" ? "bg-mk-violet text-white" : "text-white/50 hover:text-white"
            }`}
          >
            {t.legal.privacyLong}
          </Link>
          <Link
            href="/terms"
            className={`flex-1 py-2 rounded-xl text-xs font-bold text-center transition-all ${
              activeDoc === "terms" ? "bg-mk-violet text-white" : "text-white/50 hover:text-white"
            }`}
          >
            {t.legal.termsLong}
          </Link>
        </div>

        {/* Two-Column Grid: TOC + Document Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Sticky Table of Contents (Desktop) */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-28 self-start">
            <div className="p-6 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl shadow-xl">
              <h3 className="text-xs font-bold text-mk-violet-light uppercase tracking-widest mb-4 flex items-center gap-2">
                <Lock size={14} />
                {t.legal.tableOfContents}
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
                          ? "bg-mk-violet/15 text-mk-violet-light border border-mk-violet/30 font-semibold"
                          : "text-white/50 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <span className="truncate pr-2">{section.title}</span>
                      <ChevronRight
                        size={12}
                        className={`transition-transform duration-200 ${
                          isActive ? "text-mk-violet-light translate-x-0.5" : "text-white/30 group-hover:text-white/60"
                        }`}
                      />
                    </a>
                  );
                })}
              </nav>

              {/* Quick Switch Card */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-[11px] text-white/50 mb-2">{t.legal.relatedDocument}</p>
                <Link
                  href={otherHref}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-mk-violet/30 transition-all text-xs text-white/80 group"
                >
                  <span className="font-semibold">{otherViewLabel}</span>
                  <ChevronRight size={14} className="text-mk-violet-light group-hover:translate-x-1 transition-transform" />
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
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{section.title}</h2>
                  {section.badge && (
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white/5 border border-white/10 text-white/50">
                      {section.badge}
                    </span>
                  )}
                </div>

                {/* Section Paragraphs */}
                <div className="space-y-4 text-sm sm:text-base text-white/70 leading-relaxed">
                  {section.content.map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>

                {/* Bullet Points */}
                {section.bulletPoints && section.bulletPoints.length > 0 && (
                  <ul className="mt-4 space-y-2.5">
                    {section.bulletPoints.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-white/70 leading-relaxed">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-mk-violet-light shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Callout Box: semantic colors (success, warning, info) stay as they are */}
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
                        <strong className="block font-semibold mb-1 text-white">{section.callout.title}</strong>
                        <p className="text-white/70">{section.callout.text}</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            ))}

            {/* Bottom Card: Switch to the other document */}
            <div className="p-8 rounded-3xl border border-mk-violet/20 bg-mk-card flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">{otherCtaTitle}</h3>
                <p className="text-sm text-white/60 max-w-md">{otherCtaDesc}</p>
              </div>

              <Link href={otherHref} className={ctaButton}>
                <span>{otherCtaLabel}</span>
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
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-mk-violet hover:bg-mk-violet/80 text-white shadow-[0_4px_20px_rgba(124,58,237,0.5)] border border-white/20 transition-all hover:scale-110"
          aria-label={t.legal.backToTop}
        >
          <ArrowUp size={18} />
        </button>
      )}

      {/* Root Domain Marketing Footer */}
      {isRootDomain && <MarketingFooter />}
    </div>
  );
}
