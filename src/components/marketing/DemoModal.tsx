"use client";
// src/components/marketing/DemoModal.tsx
import { useEffect } from "react";
import { useTranslation } from "@/i18n";

export default function DemoModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      id="demo-modal-overlay"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-4xl rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(124,58,237,0.3)]"
        style={{ background: "#0d0d1a" }}
      >
        {/* Close button */}
        <button
          id="demo-modal-close"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg transition-all duration-200 hover:scale-110"
          aria-label="Close demo"
        >
          ×
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-4 border-b border-white/6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 mb-3">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">{t.modals.demo.badge}</span>
          </div>
          <h3 className="text-white text-2xl font-black">{t.modals.demo.title}</h3>
          <p className="text-gray-500 text-sm mt-1">{t.modals.demo.desc}</p>
        </div>

        {/* Video embed */}
        <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
          {/* Placeholder — replace the src with real video URL */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-6"
            style={{ background: "linear-gradient(135deg, #0d0d1a 0%, #1a0a2e 100%)" }}
          >
            {/* Aurora glow */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 50%, #7C3AED, transparent 70%)",
              }}
            />

            {/* Play button placeholder */}
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center cursor-pointer group transition-all duration-300 hover:scale-110"
                style={{
                  background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
                  boxShadow: "0 0 40px rgba(124,58,237,0.5)",
                }}
              >
                <svg className="w-8 h-8 fill-white ml-1" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm font-medium">
                {t.modals.demo.comingSoon}
              </p>
              <p className="text-gray-600 text-xs max-w-sm text-center">
                {t.modals.demo.meanwhile}
              </p>

              <a
                href="#contact"
                onClick={onClose}
                className="mt-4 px-8 py-3 rounded-xl font-bold text-sm text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
              >
                {t.modals.demo.btnTrial}
              </a>
            </div>

            {/* Feature highlights row */}
            <div className="relative z-10 flex flex-wrap justify-center gap-3 mt-4">
              {[
                t.modals.demo.feature1,
                t.modals.demo.feature2,
                t.modals.demo.feature3,
              ].map((item) => (
                <span
                  key={item}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold text-gray-300 border border-white/10 bg-white/5"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
