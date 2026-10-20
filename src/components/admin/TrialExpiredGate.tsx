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
        className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-mk-bg/95"
        style={{ backdropFilter: "blur(12px)" }}
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

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-mk-red/10 border border-mk-red/20 mb-6">
            <ShieldAlert size={14} className="text-mk-red" />
            <span className="text-mk-red text-xs font-bold uppercase tracking-wider">
              {isCanceled ? t.admin.canceledBadge : t.admin.trialExpiredBadge}
            </span>
          </div>

          <h2 className="text-3xl font-black text-white mb-4 tracking-tight">
            {isCanceled ? t.admin.canceledTitle : t.admin.trialExpiredTitle}
          </h2>
          <p className="text-white/60 text-base mb-8 leading-relaxed">
            {isCanceled ? t.admin.canceledDesc : t.admin.trialExpiredDesc}
          </p>

          <button
            onClick={() => setCheckoutOpen(true)}
            className="mk-btn-primary w-full py-4 rounded-2xl font-black text-base mb-4 hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] cursor-pointer"
          >
            {t.admin.upgradeButton}
          </button>

          <p className="text-white/40 text-sm">
            {t.admin.needHelp}{" "}
            <a href="mailto:info@newaigent.com" className="text-mk-violet-light hover:text-white font-semibold">
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
