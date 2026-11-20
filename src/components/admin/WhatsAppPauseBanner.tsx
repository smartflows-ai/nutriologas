"use client";
// src/components/admin/WhatsAppPauseBanner.tsx
// Ban prevention (hole 2): a visible notice in the panel when this business's WhatsApp sending is paused, so the owner
// learns it without depending on WhatsApp (the same line is paused, so its notices cannot reach the owner).
// Shows nothing when all is well, and nothing to roles without WhatsApp settings (the API answers 403).
import { useEffect, useState } from "react";
import Link from "next/link";
import { PauseCircle } from "lucide-react";
import { useTranslation } from "@/i18n";

export default function WhatsAppPauseBanner() {
  const { t } = useTranslation();
  const w = t.crm.waRisk;
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/apps/whatsapp/risk", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { riskState?: string; businessKillSwitch?: boolean; globalKillSwitch?: boolean } | null) => {
        if (cancelled || !data) return;
        const blocked = data.riskState === "SENDING_PAUSED" || data.riskState === "REQUIRES_MANUAL_REVIEW" || data.riskState === "SUSPENDED";
        setPaused(blocked || data.businessKillSwitch === true || data.globalKillSwitch === true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!paused) return null;
  return (
    <div role="status" className="mx-4 mt-3 p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-start gap-3 text-sm text-gray-900 dark:text-gray-100">
      <PauseCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium">{w.bannerTitle}</p>
        <p>{w.bannerDesc}</p>
        <Link href="/admin/whatsapp" className="underline underline-offset-2">{w.bannerLink}</Link>
      </div>
    </div>
  );
}
