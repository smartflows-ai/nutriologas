"use client";
// src/components/admin/TrialExpiredGate.tsx
import { useState } from "react";
import Image from "next/image";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import dynamic from "next/dynamic";

const AmazonCheckout = dynamic(() => import("@/components/admin/AmazonCheckout"), {
  ssr: false,
});

export default function TrialExpiredGate({ status }: { status: string }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { t } = useTranslation();

  const isCanceled = status === "CANCELED";

  return (
    <>
      <div
        className="fixed inset-0 z-[500] flex items-center justify-center p-6"
        style={{ background: "rgba(7,7,15,0.97)", backdropFilter: "blur(12px)" }}
      >
        <div className="max-w-md w-full text-center">
          <div className="flex justify-center mb-8">
            <Image
              src="/newaigent-mascot.png"
              alt="NewAigent"
              width={80}
              height={80}
              style={{
                filter: "brightness(0) invert(1) drop-shadow(0 0 20px rgba(124,58,237,0.5))",
              }}
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
            {isCanceled ? t.admin.canceledDesc : t.admin.trialExpiredDesc}
          </p>

          <button
            onClick={() => setCheckoutOpen(true)}
            className="w-full py-4 rounded-2xl font-black text-white text-base mb-4 transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
          >
            {t.admin.upgradeButton}
          </button>

          <p className="text-gray-600 text-sm">
            {t.admin.needHelp}{" "}
            <a href="mailto:info@newaigent.com" className="text-violet-400 hover:text-violet-300 font-semibold">
              info@newaigent.com
            </a>
          </p>
        </div>
      </div>

      {/* In-app Amazon Checkout Modal over the Gate */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-5xl my-8">
            <AmazonCheckout
              onSuccess={() => {
                setCheckoutOpen(false);
                window.location.href = "/admin/dashboard?subscribed=true";
              }}
              onCancel={() => setCheckoutOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
