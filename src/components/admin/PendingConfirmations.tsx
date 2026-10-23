"use client";
// src/components/admin/PendingConfirmations.tsx
// Visits waiting for the customer's SI after a reminder, with confirm and release-now actions.
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Phone, XCircle } from "lucide-react";
import { useTranslation } from "@/i18n";
import { localeFor } from "@/lib/utils";

interface PendingVisit {
  id: string;
  customerName: string;
  customerPhone: string | null;
  service: string;
  appointmentDate: string;
  durationMinutes: number;
  releaseAt: string;
}

export default function PendingConfirmations() {
  const { t, lang } = useTranslation();
  const tx = t.crm.whatsapp;
  const locale = localeFor(lang);
  const [items, setItems] = useState<PendingVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/apps/whatsapp/confirmations");
      if (!res.ok) throw new Error("load");
      const data = await res.json();
      setItems(data.items ?? []);
      setError(null);
    } catch {
      setError(tx.confirmationsLoadError);
    } finally {
      setLoading(false);
    }
  }, [tx.confirmationsLoadError]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, action: "confirm" | "release") => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/apps/whatsapp/confirmations/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("action");
      await load();
    } catch {
      setError(tx.confirmationsActionError);
    } finally {
      setBusyId(null);
    }
  };

  const formatWhen = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      timeZone: "America/Mexico_City",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-6 text-gray-400 text-sm">
        <Loader2 size={16} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">{tx.confirmationsDesc}</p>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 text-center text-sm text-gray-500 dark:text-gray-400">
          {tx.confirmationsEmpty}
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          {items.map((visit) => (
            <li key={visit.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                  {visit.customerName || visit.customerPhone || "—"}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {visit.service} · {formatWhen(visit.appointmentDate)} · {visit.durationMinutes} min
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {tx.confirmationsDeadline}: {formatWhen(visit.releaseAt)}
                </p>
                {visit.customerPhone && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                    <Phone size={12} /> {visit.customerPhone}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => act(visit.id, "confirm")}
                  disabled={busyId === visit.id}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  {busyId === visit.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {tx.confirmationsConfirm}
                </button>
                <button
                  type="button"
                  title={tx.confirmationsReleaseHint}
                  onClick={() => act(visit.id, "release")}
                  disabled={busyId === visit.id}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  <XCircle size={14} />
                  {tx.confirmationsRelease}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
