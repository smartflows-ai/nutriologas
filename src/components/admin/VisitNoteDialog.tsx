"use client";
// src/components/admin/VisitNoteDialog.tsx
// Clinical note of one visit, plus the patient's notes from earlier visits. Used by the agenda and the patient page.
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MessageSquare, XCircle } from "lucide-react";
import { useTranslation } from "@/i18n";
import { localeFor } from "@/lib/utils";

interface HistoryNote {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
  appointment: { id: string; appointmentDate: string; product: { name: string } | null } | null;
}

interface Props {
  visitId: string;
  initialText: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function VisitNoteDialog({ visitId, initialText, onClose, onSaved }: Props) {
  const { t, lang } = useTranslation();
  const locale = localeFor(lang);
  const [draft, setDraft] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryNote[]>([]);
  const [patientKey, setPatientKey] = useState<string | null>(null);
  const [linked, setLinked] = useState(true);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    fetch(`/api/appointments/${visitId}/history`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (ignore || !d) return;
        setHistory(d.notes ?? []);
        setPatientKey(d.patientKey ?? null);
        setLinked(!!d.linked);
      })
      .catch((e) => console.error("Error loading patient history:", e))
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [visitId]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/appointments/${visitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalNotes: draft }),
      });
      if (!res.ok) throw new Error("save_failed");
      toast.success(t.agenda.toastNotesSaved);
      onSaved();
      onClose();
    } catch {
      toast.error(t.agenda.toastNotesError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col p-6 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white text-base flex items-center gap-2">
            <MessageSquare size={18} className="text-primary" />
            {t.agenda.notesModalTitle}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={t.common.close}
          >
            <XCircle size={18} />
          </button>
        </div>

        <div className="py-4 space-y-3 overflow-y-auto">
          <p className="text-xs text-gray-500">{t.agenda.notesPrivate}</p>
          <textarea
            rows={5}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.agenda.notesPlaceholder}
            className="w-full text-xs p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:bg-white dark:focus:bg-gray-900 text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-primary"
          />

          <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">{t.agenda.patientHistory}</p>
            {loading ? (
              <p className="text-xs text-gray-400">{t.agenda.loading}</p>
            ) : !linked ? (
              <p className="text-xs text-gray-400">{t.agenda.notLinked}</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-gray-400">{t.agenda.historyEmpty}</p>
            ) : (
              <ul className="max-h-60 overflow-y-auto space-y-2">
                {history.map((n) => (
                  <li key={n.id} className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2">
                    <p className="text-xs text-gray-500 mb-1">
                      {new Date(n.appointment?.appointmentDate ?? n.createdAt).toLocaleString(locale, {
                        timeZone: "America/Mexico_City",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {n.appointment?.product?.name ? ` · ${n.appointment.product.name}` : ""}
                      {n.appointment?.id === visitId ? ` · ${t.agenda.historyThisVisit}` : ""}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line break-words">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
            {linked && patientKey && (
              <Link href={`/admin/historial/${patientKey}`} className="inline-block mt-3 text-xs font-medium text-primary hover:underline">
                {t.agenda.viewFullHistory}
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors">
            {t.agenda.cancel}
          </button>
          <button onClick={save} disabled={saving} className="btn-primary text-xs px-5 py-2 disabled:opacity-50">
            {t.agenda.save}
          </button>
        </div>
      </div>
    </div>
  );
}
