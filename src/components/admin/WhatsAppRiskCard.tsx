"use client";
// src/components/admin/WhatsAppRiskCard.tsx
// Ban prevention: the sending status of this business's WhatsApp, the business pause and the person-only resume.
// Shows what is known, never a percentage, and never calls a restriction a confirmed ban.
// Reads GET /api/apps/whatsapp/risk; writes PATCH (business pause) and POST /risk/resume (after a confirmation).
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, PauseCircle, ShieldAlert } from "lucide-react";
import { useTranslation } from "@/i18n";

type RiskPayload = {
  riskState: string;
  statusReason: string | null;
  businessKillSwitch: boolean;
  globalKillSwitch: boolean;
};

const STATE_ICON: Record<string, typeof CheckCircle2> = {
  NORMAL: CheckCircle2,
  OBSERVATION: AlertTriangle,
  DEGRADED: AlertTriangle,
  SENDING_PAUSED: PauseCircle,
  REQUIRES_MANUAL_REVIEW: ShieldAlert,
  SUSPENDED: ShieldAlert,
};

export default function WhatsAppRiskCard() {
  const { t } = useTranslation();
  const w = t.crm.waRisk;
  const [data, setData] = useState<RiskPayload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sendsMessage, setSendsMessage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/apps/whatsapp/risk", { cache: "no-store" });
      if (!res.ok) throw new Error("status");
      setData(await res.json());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stateLabel = (state: string) => {
    switch (state) {
      case "NORMAL": return w.stateNormal;
      case "OBSERVATION": return w.stateObservation;
      case "DEGRADED": return w.stateDegraded;
      case "SENDING_PAUSED": return w.statePaused;
      case "REQUIRES_MANUAL_REVIEW": return w.stateReview;
      default: return w.stateSuspended;
    }
  };

  const reasonLabel = (reason: string | null) => {
    if (!reason) return null;
    if (reason.startsWith("possible_restriction") || reason === "logged_out") return w.reasonRestriction;
    if (reason === "auth") return w.reasonAuth;
    if (reason === "consecutive_failures") return w.reasonFailures;
    if (reason.startsWith("disconnected")) return w.reasonDisconnected;
    return null;
  };

  const toggleBusiness = async () => {
    if (!data) return;
    setSaving(true);
    setSendsMessage(null);
    try {
      const res = await fetch("/api/apps/whatsapp/risk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessKillSwitch: !data.businessKillSwitch }),
      });
      if (!res.ok) throw new Error("save");
      setSendsMessage(w.saved);
      await load();
    } catch {
      setSendsMessage(w.saveError);
    } finally {
      setSaving(false);
    }
  };

  const resume = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/apps/whatsapp/risk/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmReviewed: confirmed }),
      });
      if (!res.ok) throw new Error("save");
      setConfirmed(false);
      setMessage(w.saved);
      await load();
    } catch {
      setMessage(w.saveError);
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <section className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <p className="text-sm text-red-700 dark:text-red-300">{w.loadError}</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" /> {w.loading}
      </section>
    );
  }

  const Icon = STATE_ICON[data.riskState] ?? ShieldAlert;
  const reason = reasonLabel(data.statusReason);
  const canResume = data.riskState === "SENDING_PAUSED" || data.riskState === "REQUIRES_MANUAL_REVIEW";

  return (
    <section className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 space-y-5">
      <div className="space-y-1">
        <h3 className="font-semibold text-gray-900 dark:text-white">{w.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{w.desc}</p>
      </div>

      <div className="flex items-start gap-3">
        <Icon size={18} className="mt-0.5 shrink-0 text-gray-700 dark:text-gray-200" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{stateLabel(data.riskState)}</p>
          {reason && <p className="text-sm text-gray-600 dark:text-gray-300">{reason}</p>}
          {data.globalKillSwitch && <p className="text-sm text-gray-600 dark:text-gray-300">{w.platformPaused}</p>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-gray-200 dark:border-gray-800 pt-4">
        <label htmlFor="wa-business-sends" className="min-w-0">
          <span className="block text-sm font-medium text-gray-900 dark:text-white">{w.businessSends}</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">{w.businessPauseDesc}</span>
        </label>
        <div className="flex items-center gap-3 shrink-0">
          {sendsMessage && <span className="text-sm text-gray-600 dark:text-gray-300">{sendsMessage}</span>}
          <input
            id="wa-business-sends"
            type="checkbox"
            checked={!data.businessKillSwitch}
            onChange={toggleBusiness}
            disabled={saving}
            className="check-themed mt-0"
          />
        </div>
      </div>

      {canResume && (
        <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{w.resumeTitle}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{w.resumeNeed}</p>
          <div className="flex items-center justify-between gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              {w.resumeConfirm}
            </label>
            <button
              type="button"
              onClick={resume}
              disabled={saving || !confirmed}
              className="btn-primary"
            >
              {w.resumeBtn}
            </button>
          </div>
        </div>
      )}

      {message && <p className="text-sm text-gray-600 dark:text-gray-300 text-right">{message}</p>}
    </section>
  );
}
