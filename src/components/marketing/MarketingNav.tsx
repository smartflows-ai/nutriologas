"use client";
// src/components/marketing/MarketingNav.tsx
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

export default function MarketingNav({ onSignIn, onGetStarted }: { onSignIn?: () => void; onGetStarted?: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#features", label: "Features" },
    { href: "#how-it-works", label: "How It Works" },
    { href: "#pricing", label: "Pricing" },
    { href: "#testimonials", label: "Testimonials" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#07070f]/80 backdrop-blur-xl border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.4)]"
          : "bg-[#07070f]/60 backdrop-blur-lg border-b border-white/5 md:bg-transparent md:backdrop-blur-none md:border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-9 h-9 transition-transform duration-300 group-hover:scale-110">
              <Image
                src="/newaigent-mascot.png"
                alt="NeoAigent mascot"
                fill
                className="object-contain relative z-10 drop-shadow-[0_0_20px_rgba(124,58,237,0.4)]"
                style={{ filter: "brightness(0) invert(1) drop-shadow(0 0 10px rgba(124,58,237,0.6))" }}
              />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Neo<span className="text-violet-400">Aigent</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all duration-200 font-medium"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button
              id="nav-signin"
              onClick={onSignIn}
              className="text-sm text-gray-400 hover:text-white transition-colors duration-200 font-medium px-3 py-2"
            >
              Sign In
            </button>
            <button
              id="nav-get-started"
              onClick={onGetStarted}
              className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white overflow-hidden transition-all duration-300 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)]"
              style={{
                background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
              }}
            >
              <span className="relative z-10">Get Started Free</span>
              <span className="relative z-10 transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            id="mobile-menu-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            <div className="w-5 h-4 flex flex-col justify-between">
              <span className={`block h-0.5 bg-current transition-all duration-300 ${mobileOpen ? "rotate-45 translate-y-1.5" : ""}`} />
              <span className={`block h-0.5 bg-current transition-all duration-300 ${mobileOpen ? "opacity-0" : ""}`} />
              <span className={`block h-0.5 bg-current transition-all duration-300 ${mobileOpen ? "-rotate-45 -translate-y-2.5" : ""}`} />
            </div>
          </button>
        </div>

        <div
          className={`md:hidden transition-all duration-300 overflow-hidden ${
            mobileOpen ? "max-h-96 pb-6" : "max-h-0"
          }`}
        >
          <nav className="flex flex-col gap-1 pt-2 border-t border-white/10">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-4 py-3 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-white/5 px-2">
              <button
                onClick={() => {
                  setMobileOpen(false);
                  onSignIn && onSignIn();
                }}
                className="w-full text-center px-5 py-3 text-sm font-semibold text-gray-300 hover:text-white rounded-xl border border-white/10 bg-white/5 transition-all"
              >
                Sign In
              </button>
              <button
                id="mobile-get-started"
                onClick={() => { setMobileOpen(false); onGetStarted && onGetStarted(); }}
                className="w-full text-center px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-[0_4px_14px_rgba(124,58,237,0.3)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.4)] transition-all"
                style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
              >
                Get Started Free
              </button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
