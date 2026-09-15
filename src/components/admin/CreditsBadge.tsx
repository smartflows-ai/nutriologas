"use client";
// src/components/admin/CreditsBadge.tsx
// Compact credit usage indicator shown in the AdminSidebar.
// Clicking opens the CreditsDrawer.

import { useState, useEffect } from "react";
import { Zap, AlertTriangle, ChevronRight } from "lucide-react";
import { useTranslation } from "@/i18n";
import CreditsDrawer from "./CreditsDrawer";

interface CreditStatus {
  limitUsd: number;
  usedUsd: number;
  remainingUsd: number;
  isExhausted: boolean;
  percentUsed: number;
  periodStart: string;
  periodEnd: string;
  promptTokens: number;
  completionTokens: number;
}

export default function CreditsBadge() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<CreditStatus | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const fetchStatus = () => {
      fetch("/api/credits")
        .then((r) => r.json())
        .then((d) => { if (d.creditStatus) setStatus(d.creditStatus); })
        .catch(() => {});
    };

    fetchStatus();

    const handleUpdate = (e: any) => {
      if (e?.detail) {
        setStatus(e.detail);
      } else {
        fetchStatus();
      }
    };

    window.addEventListener("credits-updated", handleUpdate);
    return () => window.removeEventListener("credits-updated", handleUpdate);
  }, []);


  if (!status) return null;

  const isWarning  = status.percentUsed >= 70 && !status.isExhausted;
  const isExhausted = status.isExhausted;

  const barColor = isExhausted
    ? "bg-red-500"
    : isWarning
    ? "bg-amber-400"
    : "bg-primary";

  const textColor = isExhausted
    ? "text-red-600 dark:text-red-400"
    : isWarning
    ? "text-amber-600 dark:text-amber-400"
    : "text-gray-500 dark:text-gray-400";

  return (
    <>
      <button
        id="credits-badge-btn"
        onClick={() => setDrawerOpen(true)}
        className="w-full group rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-3 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 text-left"
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isExhausted || isWarning ? (
              <AlertTriangle
                size={14}
                className={isExhausted ? "text-red-500" : "text-amber-500"}
              />
            ) : (
              <Zap size={14} className="text-primary fill-primary/20" />
            )}
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              {t.crm.credits.badge}
            </span>
          </div>
          <ChevronRight
            size={12}
            className="text-gray-400 group-hover:text-primary transition-colors"
          />
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-1.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(100, status.percentUsed)}%` }}
          />
        </div>

        {/* Amount text */}
        <div className={`flex justify-between text-[10px] font-medium ${textColor}`}>
          <span>${status.usedUsd.toFixed(3)} {t.crm.credits.used}</span>
          <span>${status.limitUsd.toFixed(2)} {t.crm.credits.limit}</span>
        </div>

        {isExhausted && (
          <p className="mt-1.5 text-[10px] text-red-500 font-semibold text-center leading-tight">
            {t.crm.credits.exhaustedTitle} — {t.crm.credits.recharge}
          </p>
        )}
      </button>

      {drawerOpen && (
        <CreditsDrawer
          status={status}
          onClose={() => setDrawerOpen(false)}
          onRefresh={() => {
            fetch("/api/credits")
              .then((r) => r.json())
              .then((d) => { if (d.creditStatus) setStatus(d.creditStatus); })
              .catch(() => {});
          }}
        />
      )}
    </>
  );
}
