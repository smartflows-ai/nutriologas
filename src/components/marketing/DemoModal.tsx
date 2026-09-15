"use client";
// src/components/marketing/DemoModal.tsx
import { useEffect } from "react";
import { useTranslation } from "@/i18n";
import { Check, ArrowRight } from "lucide-react";

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

        {/* Video player */}
        <div className="relative w-full bg-black flex items-center justify-center overflow-hidden" style={{ minHeight: "360px" }}>
          <video
            controls
            autoPlay
            playsInline
            className="w-full h-auto max-h-[72vh] object-contain"
            src="/demo-video.mp4"
          >
            <source src="/demo-video.mp4" type="video/mp4" />
            <source src="/demo%20video/NewAigent%20video%20espa%C3%B1ol.mp4" type="video/mp4" />
            Tu navegador no soporta la reproducción de video HTML5.
          </video>
        </div>

        {/* Modal Footer with quick actions */}
        <div className="px-8 py-5 border-t border-white/6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0a0a14]">
          <div className="flex flex-wrap items-center gap-2">
            {[
              t.modals.demo.feature1,
              t.modals.demo.feature2,
              t.modals.demo.feature3,
            ].map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-gray-300 border border-white/10 bg-white/5"
              >
                <Check size={12} className="text-emerald-400" />
                {item}
              </span>
            ))}
          </div>

          <a
            href="#pricing"
            onClick={onClose}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white text-center transition-all duration-300 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
          >
            <span>{t.modals.demo.btnTrial}</span>
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
