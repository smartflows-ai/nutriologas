"use client";
// src/components/admin/CreditsDrawer.tsx
// Slide-over drawer with detailed credit usage, token breakdown, and recharge CTA.

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Zap, AlertTriangle, CreditCard, RefreshCw, Coins, Cpu } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";

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

interface Props {
  status: CreditStatus;
  onClose: () => void;
  onRefresh: () => void;
}

export default function CreditsDrawer({ status, onClose, onRefresh }: Props) {
  const { t, lang } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [recharging, setRecharging] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isExhausted = status.isExhausted;
  const isWarning   = status.percentUsed >= 70 && !isExhausted;

  const locale = lang === "es" ? "es-MX" : "en-US";

  const periodStartFmt = new Date(status.periodStart).toLocaleDateString(locale, {
    day: "numeric", month: "long",
  });
  const periodEndFmt = new Date(status.periodEnd).toLocaleDateString(locale, {
    day: "numeric", month: "long",
  });

  async function handleRecharge() {
    setRecharging(true);
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: 15 }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("No se pudo iniciar el pago. Intenta de nuevo.");
      }
    } catch {
      toast.error("Error al conectar con el servidor de pagos.");
    } finally {
      setRecharging(false);
    }
  }

  const totalTokens = status.promptTokens + status.completionTokens;

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
        onClick={onClose}
      />

      {/* Drawer - pinned to left */}
      <aside
        className="fixed left-0 top-0 h-full w-full max-w-sm sm:w-96 z-[9999] bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300"
        style={{ fontFamily: "var(--font-family-base), system-ui, sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
              <Zap size={16} className="text-primary fill-primary/30" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-sm">
                {t.crm.credits.title}
              </h2>
              <p className="text-[10px] text-gray-400">
                {periodStartFmt} – {periodEndFmt}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { onRefresh(); }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Actualizar"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Alert banner */}
          {isExhausted && (
            <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
              <div className="flex gap-3">
                <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-700 dark:text-red-400 mb-1">
                    {t.crm.credits.exhaustedTitle}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-300 leading-relaxed">
                    {t.crm.credits.exhaustedDesc}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isWarning && !isExhausted && (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
              <div className="flex gap-3">
                <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                  {t.crm.credits.warningDesc}
                </p>
              </div>
            </div>
          )}

          {/* Usage meter */}
          <div className="rounded-2xl bg-gray-50/80 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4">
            <div className="flex justify-between items-end mb-3">
              <div>
                <p className="text-2xl font-black text-gray-900 dark:text-white">
                  ${status.usedUsd.toFixed(3)}
                </p>
                <p className="text-xs text-gray-400">
                  {t.crm.credits.limit}: ${status.limitUsd.toFixed(2)} USD
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${
                  isExhausted ? "text-red-500" : isWarning ? "text-amber-500" : "text-primary"
                }`}>
                  {status.percentUsed.toFixed(0)}%
                </p>
                <p className="text-[10px] text-gray-400">
                  {t.crm.credits.used}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  isExhausted ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-primary"
                }`}
                style={{
                  width: `${Math.min(100, status.percentUsed)}%`,
                }}
              />
            </div>

            <p className="mt-2 text-[11px] text-gray-400 text-right">
              ${status.remainingUsd.toFixed(3)} {t.crm.credits.remaining}
            </p>
          </div>

          {/* Token breakdown */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <div className="px-4 py-3 bg-gray-50/60 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {t.crm.credits.tokenBreakdown}
              </h3>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Cpu size={14} className="text-blue-400" />
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                      {t.crm.credits.inputTokens}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {t.crm.credits.inputTokensDesc}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  {status.promptTokens.toLocaleString(locale)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Zap size={14} className="text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                      {t.crm.credits.outputTokens}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {t.crm.credits.outputTokensDesc}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  {status.completionTokens.toLocaleString(locale)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-gray-800/30">
                <div className="flex items-center gap-2.5">
                  <Coins size={14} className="text-gray-400" />
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                    {t.crm.credits.totalTokens}
                  </p>
                </div>
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  {totalTokens.toLocaleString(locale)}
                </span>
              </div>
            </div>
          </div>

          {/* Info note */}
          <p className="text-[10px] text-gray-400 leading-relaxed px-1">
            {t.crm.credits.renewalNote}
          </p>
        </div>

        {/* Footer CTA */}
        <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-950">
          <button
            id="credits-recharge-btn"
            onClick={handleRecharge}
            disabled={recharging}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 px-5 !rounded-xl font-bold text-sm shadow-md"
          >
            {recharging ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {t.crm.credits.redirecting}
              </>
            ) : (
              <>
                <CreditCard size={16} />
                {t.crm.credits.rechargeBtn}
              </>
            )}
          </button>
          <p className="text-[10px] text-center text-gray-400 mt-2">
            {t.crm.credits.secureStripe}
          </p>
        </div>
      </aside>
    </>,
    document.body
  );
}
