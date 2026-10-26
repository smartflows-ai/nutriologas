"use client";
// src/app/admin/historial/[key]/page.tsx
// One patient: every visit in date order, with the reason and the clinical note of each visit.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Loader2, Mail, Pencil, Phone } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useTenantMeta } from "@/components/admin/TenantMeta";
import { getVerticalProfile } from "@/lib/vertical-profile";
import { localeFor, fill } from "@/lib/utils";
import VisitNoteDialog from "@/components/admin/VisitNoteDialog";

interface Visit {
  id: string;
  date: string;
  durationMinutes: number;
  status: string;
  service: string | null;
  petId: string | null;
  petName: string | null;
  reason: string | null;
  note: { id: string; body: string; authorName: string | null; createdAt: string } | null;
}

interface Timeline {
  patient: { patientKey: string; name: string | null; phone: string | null; emails: string[]; lastSeenAt: string | null };
  visits: Visit[];
  pets: { id: string; name: string; species: string | null }[];
  orphanNotes: { id: string; body: string; authorName: string | null; createdAt: string }[];
}

// Long text shows three lines and a toggle; short text is shown as is.
function ClampedText({ text, showMore, showLess }: { text: string; showMore: string; showLess: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 180 || text.split("\n").length > 3;
  return (
    <div>
      <p className={`text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line break-words ${open || !long ? "" : "line-clamp-3"}`}>
        {text}
      </p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-xs font-medium text-primary hover:underline cursor-pointer">
          {open ? showLess : showMore}
        </button>
      )}
    </div>
  );
}

export default function PatientHistoryPage() {
  const { t, lang } = useTranslation();
  const { vertical, isBookingEnabled } = useTenantMeta();
  const subjectText = t.crm.history.subjects[getVerticalProfile(vertical, isBookingEnabled).subject];
  const locale = localeFor(lang);
  const params = useParams<{ key: string }>();
  const patientKey = params.key;

  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  // Pet filter (veterinary and pet-care only); null shows every visit of the owner.
  const [petFilter, setPetFilter] = useState<string | null>(null);
  const usesPets = getVerticalProfile(vertical, isBookingEnabled).usesPets;

  const load = useCallback(() => {
    const query = petFilter ? `?petId=${encodeURIComponent(petFilter)}` : "";
    return fetch(`/api/admin/historial/${patientKey}${query}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (d) setTimeline(d);
      })
      .catch((e) => console.error("Error loading patient timeline:", e));
  }, [patientKey, petFilter]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(locale, { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" });

  const statusLabel = (status: string) =>
    ({
      PENDING: t.agenda.statusPending,
      CONFIRMED: t.agenda.statusConfirmed,
      COMPLETED: t.agenda.statusCompleted,
      CANCELLED: t.agenda.statusCancelled,
      NO_SHOW: t.agenda.statusNoShow,
    })[status] ?? status;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
        <Loader2 className="animate-spin text-primary" size={18} />
        {subjectText.loading}
      </div>
    );
  }

  if (notFound || !timeline) {
    return (
      <div className="space-y-4">
        <Link href="/admin/historial" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ChevronLeft size={16} aria-hidden="true" />
          {subjectText.back}
        </Link>
        <p className="text-sm text-gray-500">{subjectText.empty}</p>
      </div>
    );
  }

  const { patient, visits, orphanNotes } = timeline;
  const first = visits.length > 0 ? visits[visits.length - 1] : null;
  const editingVisit = visits.find((v) => v.id === editingVisitId) ?? null;
  const whatsappDigits = patient.phone ? patient.phone.replace(/\D/g, "") : null;

  return (
    <div className="space-y-6">
      <Link href="/admin/historial" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ChevronLeft size={16} aria-hidden="true" />
        {subjectText.back}
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{patient.name ?? patient.phone ?? patient.patientKey}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
          {patient.phone && (
            <a
              href={`https://wa.me/${whatsappDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-primary"
            >
              <Phone size={14} aria-hidden="true" />
              {patient.phone}
            </a>
          )}
          <span className="flex items-center gap-1">
            <Mail size={14} aria-hidden="true" />
            {patient.emails.length > 0 ? patient.emails.join(", ") : t.crm.history.noEmail}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {fill(t.crm.history.summary, {
            visits: String(visits.length),
            first: first ? formatDateTime(first.date) : "—",
          })}
        </p>
      </div>

      {usesPets && timeline.pets.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t.crm.history.petUi.petsColumn}>
          {[{ id: null as string | null, name: t.crm.history.petUi.allPets }, ...timeline.pets.map((p) => ({ id: p.id as string | null, name: p.name }))].map((chip) => {
            const active = petFilter === chip.id;
            return (
              <button
                key={chip.id ?? "all"}
                type="button"
                onClick={() => setPetFilter(chip.id)}
                aria-pressed={active}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                  active
                    ? "bg-primary text-white border-primary"
                    : "border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                {chip.name}
              </button>
            );
          })}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t.crm.history.timelineTitle}</h2>
        <ol className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
          {visits.map((v) => (
            <li key={v.id} className="px-5 py-4 space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDateTime(v.date)}</p>
                <span className="text-xs text-gray-500 dark:text-gray-400">{v.durationMinutes} min</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{statusLabel(v.status)}</span>
                {v.service && <span className="text-xs text-gray-700 dark:text-gray-300">{v.service}</span>}
                {usesPets && <span className="text-xs text-gray-700 dark:text-gray-300">{v.petName ?? t.crm.history.petUi.noPet}</span>}
              </div>

              {v.reason && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t.crm.history.reason}</p>
                  <ClampedText text={v.reason} showMore={t.crm.history.showMore} showLess={t.crm.history.showLess} />
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t.crm.history.clinicalNote}</p>
                {v.note ? (
                  <ClampedText text={v.note.body} showMore={t.crm.history.showMore} showLess={t.crm.history.showLess} />
                ) : (
                  <p className="text-sm text-gray-400">{t.crm.history.noNote}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setEditingVisitId(v.id)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                <Pencil size={13} aria-hidden="true" />
                {t.crm.history.editNote}
              </button>
            </li>
          ))}
        </ol>
      </section>

      {orphanNotes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t.crm.history.orphanNotes}</h2>
          <ul className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {orphanNotes.map((n) => (
              <li key={n.id} className="px-5 py-4 space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(n.createdAt)}</p>
                <ClampedText text={n.body} showMore={t.crm.history.showMore} showLess={t.crm.history.showLess} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {editingVisit && (
        <VisitNoteDialog
          visitId={editingVisit.id}
          initialText={editingVisit.note?.body ?? ""}
          onClose={() => setEditingVisitId(null)}
          onSaved={() => {
            load();
          }}
        />
      )}
    </div>
  );
}
