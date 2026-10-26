"use client";
// src/app/admin/historial/page.tsx
// Patients of the tenant: one row per patient (phone-based key), with visits, notes and the next appointment.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Loader2, Phone, Search } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useTenantMeta } from "@/components/admin/TenantMeta";
import { getVerticalProfile } from "@/lib/vertical-profile";
import { localeFor } from "@/lib/utils";
import Pagination from "@/components/admin/Pagination";

interface PatientRow {
  patientKey: string;
  name: string | null;
  phone: string | null;
  visits: number;
  notes: number;
  lastVisit: string | null;
  nextVisit: string | null;
  pets: string | null;
}

export default function HistorialPage() {
  const { t, lang } = useTranslation();
  const { vertical, isBookingEnabled } = useTenantMeta();
  const profile = getVerticalProfile(vertical, isBookingEnabled);
  const subjectText = t.crm.history.subjects[profile.subject];
  const locale = localeFor(lang);

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);

  // Waits for a pause in typing before searching, and goes back to the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("q", search);
    fetch(`/api/admin/historial?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (ignore || !d) return;
        setPatients(d.patients ?? []);
        setTotal(d.total ?? 0);
        setPageSize(d.pageSize ?? 20);
      })
      .catch((e) => console.error("Error loading patients:", e))
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [search, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale, { timeZone: "America/Mexico_City", dateStyle: "medium" })
      : t.crm.history.noVisit;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2.5">
          <ClipboardList className="text-primary" size={24} />
          {subjectText.title}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subjectText.subtitle}</p>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.crm.history.searchPlaceholder}
          aria-label={t.crm.history.searchPlaceholder}
          className="input pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
          <Loader2 className="animate-spin text-primary" size={18} />
          {subjectText.loading}
        </div>
      ) : patients.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">
          {search ? subjectText.emptySearch : subjectText.empty}
        </p>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
          <div className="hidden sm:grid grid-cols-[minmax(0,2fr)_72px_72px_128px_128px] gap-4 px-5 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            <span>{subjectText.colSubject}</span>
            <span>{t.crm.history.colVisits}</span>
            <span>{t.crm.history.colNotes}</span>
            <span>{t.crm.history.colLastVisit}</span>
            <span>{t.crm.history.colNextVisit}</span>
          </div>
          {patients.map((p) => (
            <Link
              key={p.patientKey}
              href={`/admin/historial/${p.patientKey}`}
              className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_72px_72px_128px_128px] gap-x-4 gap-y-2 px-5 py-4 items-center transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/60"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name ?? p.phone}</p>
                {profile.usesPets && p.pets && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{t.crm.history.petUi.petsColumn}: {p.pets}</p>
                )}
                {p.phone && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                    <Phone size={12} aria-hidden="true" />
                    {p.phone}
                  </p>
                )}
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="sm:hidden text-gray-500">{t.crm.history.colVisits}: </span>
                {p.visits}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="sm:hidden text-gray-500">{t.crm.history.colNotes}: </span>
                {p.notes}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="sm:hidden text-gray-500">{t.crm.history.colLastVisit}: </span>
                {formatDate(p.lastVisit)}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="sm:hidden text-gray-500">{t.crm.history.colNextVisit}: </span>
                {p.nextVisit ? formatDate(p.nextVisit) : "—"}
              </p>
            </Link>
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
