"use client";
// src/components/admin/TrialBanner.tsx
import { useState } from "react";
import { Zap, X } from "lucide-react";
import { useTranslation } from "@/i18n";
import dynamic from "next/dynamic";

const AmazonCheckout = dynamic(() => import("@/components/admin/AmazonCheckout"), {
  ssr: false,
});

interface Props {
  daysLeft: number;
}

export default function TrialBanner({ daysLeft }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { t } = useTranslation();

  if (dismissed) return null;

  const isUrgent = daysLeft <= 3;

  return (
    <>
      <div
        className={`relative flex items-center justify-between px-4 py-2.5 text-sm font-medium ${
          isUrgent
            ? "bg-gradient-to-r from-orange-600/90 to-rose-600/90"
            : "bg-gradient-to-r from-violet-700/80 to-indigo-700/80"
        } backdrop-blur-sm`}
      >
        <div className="flex items-center gap-2 text-white">
          <Zap size={15} className="shrink-0" />
          <span>
            {daysLeft > 0
              ? `${t.admin.trialEndsIn} ${daysLeft} ${daysLeft !== 1 ? t.admin.trialDays : t.admin.trialDay}.`
              : t.admin.trialEnded}{" "}
          </span>
          <button
            onClick={() => setCheckoutOpen(true)}
            className="underline underline-offset-2 font-bold hover:no-underline transition-all cursor-pointer"
          >
            {t.admin.upgradeNow}
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="ml-4 text-white/60 hover:text-white transition-colors shrink-0 cursor-pointer"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      {/* In-app Amazon Checkout Modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
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
