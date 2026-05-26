"use client";
// src/components/admin/TrialExpiredGate.tsx
import { useState } from "react";
import Image from "next/image";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";

export default function TrialExpiredGate({ status }: { status: string }) {
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handlePortal = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: window.location.origin }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert("Could not open billing portal. Contact info@newaigent.com");
    } catch {
      alert("Network error. Contact info@newaigent.com");
    } finally {
      setLoading(false);
    }
  };

  const isCanceled = status === "CANCELED";

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-6"
      style={{ background: "rgba(7,7,15,0.97)", backdropFilter: "blur(12px)" }}
    >
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-8">
          <Image
            src="/newaigent-mascot.png"
            alt="NeoAigent"
            width={80} height={80}
            style={{ filter: "brightness(0) invert(1) drop-shadow(0 0 20px rgba(124,58,237,0.5))" }}
          />
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
          <ShieldAlert size={14} className="text-red-400" />
          <span className="text-red-400 text-xs font-bold uppercase tracking-wider">
            {isCanceled ? t.admin.canceledBadge : t.admin.trialExpiredBadge}
          </span>
        </div>

        <h2 className="text-3xl font-black text-white mb-4 tracking-tight">
          {isCanceled ? t.admin.canceledTitle : t.admin.trialExpiredTitle}
        </h2>
        <p className="text-gray-400 text-base mb-8 leading-relaxed">
          {isCanceled
            ? t.admin.canceledDesc
            : t.admin.trialExpiredDesc}
        </p>

        <button
          onClick={handlePortal}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-black text-white text-base mb-4 transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
        >
          {loading ? <><Loader2 size={18} className="animate-spin" /> {t.admin.openingPortal}</> : t.admin.upgradeButton}
        </button>

        <p className="text-gray-600 text-sm">
          {t.admin.needHelp}{" "}
          <a href="mailto:info@newaigent.com" className="text-violet-400 hover:text-violet-300 font-semibold">
            info@newaigent.com
          </a>
        </p>
      </div>
    </div>
  );
}
