"use client";
// src/app/admin/citas/page.tsx
// Centralized Agenda & Scheduling Hub: one unified view with all appointments
// (native CRM bookings, WhatsApp reservations, and Google / Outlook Calendar events combined)
import { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { Calendar as CalendarIcon, Clock, Search, RefreshCw, Plug, Plus } from "lucide-react";
import { localeFor, fill } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { useCalendarAccount } from "@/hooks/useCalendarAccount";
import { translateApiError } from "@/i18n/validation";
import Pagination from "@/components/admin/Pagination";
import VisitNoteDialog from "@/components/admin/VisitNoteDialog";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { useCan, useCanOpen, useTenantMeta } from "@/components/admin/TenantMeta";
import AppointmentCard from "@/components/admin/appointments/AppointmentCard";
import AppointmentFormPanel from "@/components/admin/appointments/AppointmentFormPanel";
import { AlternativesPicker } from "@/components/admin/appointments/SlotGrid";
import type { FormTarget } from "@/components/admin/appointments/useAppointmentForm";
import type { AppointmentItem, FreeSlot, VisitStatus } from "@/components/admin/appointments/types";
import { clinicDateKeyOf } from "@/lib/clinic-time";
import FilterChip from "@/components/ui/FilterChip";
import { toast } from "sonner";
import Link from "next/link";

/** Mini-calendar for interactive date navigation */
function MiniCalendar({
  viewYear,
  viewMonth,
  onMonthChange,
  appointmentDays,
  selectedDate,
  onSelectDate,
}: {
  viewYear: number;
  viewMonth: number;
  onMonthChange: (year: number, month: number) => void;
  appointmentDays: string[];
  selectedDate: string;
  onSelectDate: (d: string) => void;
}) {
  const { t, lang } = useTranslation();
  const locale = localeFor(lang);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  // Days of the viewed month that have appointments (YYYY-MM-DD, from the server)
  const appointmentDates = useMemo(() => new Set(appointmentDays), [appointmentDays]);

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  // Single-letter weekday headers in the active locale, starting on Sunday
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + i).toLocaleDateString(locale, { weekday: "narrow" })
  );

  const prevMonth = () =>
    viewMonth === 0 ? onMonthChange(viewYear - 1, 11) : onMonthChange(viewYear, viewMonth - 1);
  const nextMonth = () =>
    viewMonth === 11 ? onMonthChange(viewYear + 1, 0) : onMonthChange(viewYear, viewMonth + 1);

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDayOfWeek }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
          title={t.agenda.prevMonth}
          aria-label={t.agenda.prevMonth}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 capitalize">{monthName}</span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
          title={t.agenda.nextMonth}
          aria-label={t.agenda.nextMonth}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center mb-2">
        {weekdayLabels.map((d, i) => (
          <span key={i} className="text-xs font-semibold text-gray-400 ">
            {d}
          </span>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {cells.map((day, idx) => {
          if (!day) return <span key={idx} />;
          const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isSelected = selectedDate === dateKey;
          const hasAppt = appointmentDates.has(dateKey);
          const isToday = dateKey === todayDateKey();

          return (
            <button
              key={idx}
              onClick={() => onSelectDate(isSelected ? "" : dateKey)}
              className={`relative h-8 w-8 mx-auto rounded-xl flex flex-col items-center justify-center text-xs font-medium transition-all ${
                isSelected
                  ? "bg-primary text-[color:var(--on-primary)] font-semibold ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-900"
                  : isToday
                  ? "border border-primary text-primary font-semibold"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <span>{day}</span>
              {hasAppt && (
                <span
                  className={`absolute bottom-1 w-1 h-1 rounded-full ${
                    isSelected ? "bg-white" : "bg-primary"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Clear selection shortcut */}
      {selectedDate && (
        <button
          onClick={() => onSelectDate("")}
          className="mt-3 w-full py-1.5 text-center text-[11px] font-semibold text-primary hover:underline"
        >
          {t.agenda.showAll}
        </button>
      )}
    </div>
  );
}

// Today on the clinic calendar (Mexico City), as YYYY-MM-DD: the same day the bot and the reminders use,
// whatever timezone the browser is in.
function todayDateKey(): string {
  return clinicDateKeyOf(new Date());
}

function CitasContent() {
  const { t, lang } = useTranslation();
  // Clinical notes are ADMIN only (src/lib/permissions.ts); the API also leaves them out for STAFF.
  const canNotes = useCan("appointments.notes");
  // The App Store (connect a calendar, integrations) is ADMIN only.
  const canOpenApps = useCanOpen("/admin/apps");
  const locale = localeFor(lang);
  // Agenda state. The server filters and paginates; the page only keeps the query and the last response.
  const PAGE_SIZE = 20;
  const [items, setItems] = useState<AppointmentItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [appointmentDays, setAppointmentDays] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewYear, setViewYear] = useState(() => Number(todayDateKey().slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(todayDateKey().slice(5, 7)) - 1);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  // The page opens on today's appointments; the date chips above the list switch between today, a chosen day and all dates.
  const [selectedDate, setSelectedDate] = useState<string>(todayDateKey);
  const todayKey = todayDateKey();
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [hasCalendarIntegration, setHasCalendarIntegration] = useState(false);
  const calendarAccount = useCalendarAccount();

  // Ticket #103: the owner and staff create, edit, delete and restore visits here (src/lib/permissions.ts).
  const canBook = useCan("appointments.book");
  const canEdit = useCan("appointments.reschedule");
  const canDelete = useCan("appointments.delete");
  const canOverbook = useCan("appointments.overbook");
  const { isBookingEnabled } = useTenantMeta();
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [deleting, setDeleting] = useState<AppointmentItem | null>(null);
  const [restoring, setRestoring] = useState<{ visit: AppointmentItem; alternatives: FreeSlot[] } | null>(null);
  const refresh = () => setRefreshKey((k) => k + 1);

  // Escape closes the free-times dialog, like the other dialogs of the panel.
  useEffect(() => {
    if (!restoring) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRestoring(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [restoring]);

  // Check if an external calendar is connected
  useEffect(() => {
    const now = new Date().toISOString();
    fetch(`/api/calendar/events?start=${now}&end=${now}`)
      .then((r) => r.json())
      .then((d) => setHasCalendarIntegration(!!d.hasExternalCalendar))
      .catch(() => {});
  }, []);

  // Set when the last load was triggered by an update (refreshKey), not by a filter change.
  const lastRefreshKey = useRef(refreshKey);

  // Loads the viewed month with the current filters. Stale responses are ignored.
  useEffect(() => {
    let ignore = false;
    // An update only refreshes the list: keep the rows on screen instead of showing the full loader.
    const isUpdateRefresh = lastRefreshKey.current !== refreshKey;
    lastRefreshKey.current = refreshKey;
    const params = new URLSearchParams({
      month: `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`,
      status: activeTab,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (selectedDate) params.set("day", selectedDate);
    if (searchTerm.trim()) params.set("q", searchTerm.trim());

    if (!isUpdateRefresh) setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/appointments?${params.toString()}`);
        const data = await res.json();
        if (ignore || !data || !Array.isArray(data.items)) return;
        setItems(data.items);
        setTotal(data.total ?? 0);
        setCounts(data.counts ?? {});
        setAppointmentDays(data.days ?? []);
      } catch (e) {
        console.error("Error fetching appointments:", e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }, 250);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [viewYear, viewMonth, activeTab, selectedDate, searchTerm, page, refreshKey]);

  // Any filter change starts again from the first page
  const changeMonth = (year: number, month: number) => {
    setViewYear(year);
    setViewMonth(month);
    setPage(1);
  };
  const changeDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setPage(1);
  };
  const changeTab = (tabId: string) => {
    setActiveTab(tabId);
    setPage(1);
  };
  const changeSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setRefreshKey((k) => k + 1);
        if (data.calendarSynced === false) toast.warning(t.agenda.toastCalendarNotUpdated);
        if (newStatus === "CONFIRMED") {
          if (data.whatsappSent) {
            toast.success(t.agenda.toastConfirmedWa);
          } else if (data.whatsappReason) {
            toast.info(fill(t.agenda.toastConfirmedWaReason, { reason: data.whatsappReason }));
          } else {
            toast.success(t.agenda.toastConfirmed);
          }
        } else if (newStatus === "COMPLETED") {
          toast.success(t.agenda.toastCompleted);
        } else if (newStatus === "CANCELLED") {
          toast.error(t.agenda.toastCancelled);
        } else if (newStatus === "NO_SHOW") {
          toast.warning(t.agenda.toastNoShow);
        }
      } else {
        const d = await res.json();
        toast.error(translateApiError(t, d.error) || t.agenda.toastUpdateError);
      }
    } catch {
      toast.error(t.agenda.toastUpdateErrorNet);
    } finally {
      setUpdatingId(null);
    }
  };

  // Soft delete: the visit leaves the agenda and frees its time; it stays in "Eliminadas" with who and when.
  const deleteVisit = async () => {
    const visit = deleting;
    if (!visit) return;
    setUpdatingId(visit.id);
    try {
      const res = await fetch(`/api/appointments/${visit.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t.agenda.toastDeleted);
        refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(translateApiError(t, d.error) || t.agenda.toastUpdateError);
      }
    } catch {
      toast.error(t.agenda.toastUpdateErrorNet);
    } finally {
      setUpdatingId(null);
      setDeleting(null);
    }
  };

  // Restore before the visit's time, never on top of another visit; a taken slot offers the nearest free times.
  const restoreVisit = async (visit: AppointmentItem, slot?: FreeSlot) => {
    setUpdatingId(visit.id);
    try {
      const res = await fetch(`/api/appointments/${visit.id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slot ? { appointmentDate: slot.iso } : {}),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(t.agenda.toastRestored);
        if (d.calendarSynced === false) toast.warning(t.agenda.toastCalendarNotUpdated);
        setRestoring(null);
        refresh();
      } else if (d.error === "slot_unavailable" || d.error === "outside_business_hours") {
        setRestoring({ visit, alternatives: Array.isArray(d.alternatives) ? d.alternatives : [] });
      } else {
        setRestoring(null);
        toast.error(translateApiError(t, d.error) || t.agenda.toastUpdateError);
      }
    } catch {
      toast.error(t.agenda.toastUpdateErrorNet);
    } finally {
      setUpdatingId(null);
    }
  };

  const onFormSaved = (kind: "created" | "updated", calendarSynced: boolean) => {
    setFormTarget(null);
    toast.success(kind === "created" ? t.agenda.toastCreated : t.agenda.toastUpdated);
    if (!calendarSynced) toast.warning(t.agenda.toastCalendarNotUpdated);
    refresh();
  };

  // KPI counts for the viewed month (from the server, not affected by the filters)
  const totalCount = counts.ALL ?? 0;
  const pendingCount = counts.PENDING ?? 0;
  const confirmedCount = counts.CONFIRMED ?? 0;
  const completedCount = counts.COMPLETED ?? 0;
  const cancelledCount = (counts.CANCELLED ?? 0) + (counts.NO_SHOW ?? 0);

  // Current page of the filtered list
  const filteredAppointments = items;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const selectedDateLabel = selectedDate
    ? new Date(selectedDate + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "long" })
    : "";

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 text-primary flex items-center justify-center">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
              {t.agenda.title}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t.agenda.subtitle}
            </p>
          </div>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {canBook && isBookingEnabled && (
            <button
              onClick={() => setFormTarget({ mode: "create" })}
              className="min-h-11 sm:min-h-0 px-3.5 py-2 rounded-xl bg-primary hover:opacity-90 text-[color:var(--on-primary)] text-xs font-semibold flex items-center gap-1.5 transition-opacity"
            >
              <Plus size={14} aria-hidden="true" />
              {t.agenda.newAppointment}
            </button>
          )}
          {hasCalendarIntegration ? (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 max-w-sm px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-semibold border border-gray-200 dark:border-gray-800"
              title={calendarAccount?.email ? fill(t.agenda.calendarAccount, { email: calendarAccount.email }) : undefined}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <span className="shrink-0">{calendarAccount?.provider === "MICROSOFT" ? t.agenda.outlookSynced : t.agenda.gcalSynced}</span>
              {calendarAccount?.email && (
                <span className="min-w-0 truncate font-normal text-gray-600 dark:text-gray-300">{calendarAccount.email}</span>
              )}
            </span>
          ) : canOpenApps && (
            <Link
              href="/admin/apps"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold transition-colors"
            >
              <span>{t.agenda.connectGcal}</span>
            </Link>
          )}

          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            title={t.agenda.reload}
            aria-label={t.agenda.reload}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
          {canOpenApps && (
            <Link
              href="/admin/apps"
              className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plug size={14} className="text-primary" />
              {t.agenda.integrations}
            </Link>
          )}
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-xs font-semibold text-gray-400 ">{t.agenda.kpiTotal}</p>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white mt-1">{totalCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 ">{t.agenda.kpiPending}</p>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white mt-1">{pendingCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 ">{t.agenda.kpiConfirmed}</p>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white mt-1">{confirmedCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 ">{t.agenda.kpiCompleted}</p>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white mt-1">{completedCount}</p>
        </div>
      </div>

      {/* ── Agenda workspace (mini calendar + unified list) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: mini calendar picker */}
        {/* Pinned only beside the list (large screens); on a phone it scrolls away instead of covering the visits. */}
        <div className="lg:col-span-4 xl:col-span-3 lg:sticky lg:top-6">
          <MiniCalendar
            viewYear={viewYear}
            viewMonth={viewMonth}
            onMonthChange={changeMonth}
            appointmentDays={appointmentDays}
            selectedDate={selectedDate}
            onSelectDate={changeDate}
          />

          {selectedDate && (
            <div className="mt-3 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 border border-primary/10 dark:border-primary/40 text-xs text-primary flex items-center justify-between">
              <span className="font-medium">{fill(t.agenda.filteredBy, { date: selectedDateLabel })}</span>
              <button onClick={() => changeDate("")} className="font-semibold underline text-primary hover:text-secondary">
                {t.agenda.clear}
              </button>
            </div>
          )}
        </div>

        {/* Right column: filters + unified appointments list */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {/* Filters: the day scope and the status each have their own labeled row; search sits on the right */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-2 min-w-0">
              <div className="flex items-start gap-3">
                <span className="w-14 shrink-0 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t.agenda.filterDate}
                </span>
                <div role="group" aria-label={t.agenda.filterDate} className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: "today", label: t.agenda.dateToday, active: selectedDate === todayKey, date: todayKey },
                    ...(selectedDate && selectedDate !== todayKey
                      ? [{ id: "picked", label: selectedDateLabel, active: true, date: selectedDate }]
                      : []),
                    { id: "all", label: t.agenda.dateAll, active: selectedDate === "", date: "" },
                  ].map((chip) => (
                    <FilterChip key={chip.id} active={chip.active} onClick={() => changeDate(chip.date)}>
                      {chip.label}
                    </FilterChip>
                  ))}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-14 shrink-0 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t.agenda.filterStatus}
                </span>
                <div role="group" aria-label={t.agenda.filterStatus} className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: "ALL", label: t.agenda.tabAll, count: totalCount },
                    { id: "PENDING", label: t.agenda.tabPending, count: pendingCount },
                    { id: "CONFIRMED", label: t.agenda.tabConfirmed, count: confirmedCount },
                    { id: "COMPLETED", label: t.agenda.tabCompleted, count: completedCount },
                    { id: "CANCELLED", label: t.agenda.tabCancelled, count: cancelledCount },
                    ...(canDelete ? [{ id: "DELETED", label: t.agenda.tabDeleted, count: counts.DELETED ?? 0 }] : []),
                  ].map((tab) => (
                    <FilterChip key={tab.id} active={activeTab === tab.id} onClick={() => changeTab(tab.id)}>
                      {tab.label} {tab.count > 0 && `(${tab.count})`}
                    </FilterChip>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                placeholder={t.agenda.searchPlaceholder}
                aria-label={t.agenda.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => changeSearch(e.target.value)}
                className="input pl-9 text-xs py-2 w-full bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-xl"
              />
            </div>
          </div>

          {/* Appointment list */}
          {loading ? (
            <div className="card p-12 text-center text-gray-400 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <Clock className="size-7 mx-auto animate-spin mb-2 text-primary" />
              <p className="text-sm">{t.agenda.loading}</p>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="card p-12 text-center text-gray-400 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <CalendarIcon className="size-9 mx-auto mb-3 opacity-25" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t.agenda.emptyTitle}</p>
              <p className="text-xs mt-1 text-gray-500">
                {selectedDate ? fill(t.agenda.emptyForDate, { date: selectedDateLabel }) : t.agenda.emptyDesc}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredAppointments.map((appt) => (
                <AppointmentCard
                  key={appt.id}
                  appt={appt}
                  locale={locale}
                  canNotes={canNotes}
                  busy={updatingId === appt.id}
                  onStatus={updateStatus}
                  onNotes={setEditingNotesId}
                  onEdit={canEdit ? (a) => setFormTarget({ mode: "edit", visit: a }) : undefined}
                  onDelete={canDelete ? setDeleting : undefined}
                  onRestore={canDelete ? (a) => void restoreVisit(a) : undefined}
                />
              ))}
            </div>
          )}
          {!loading && totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </div>
      </div>

      {/* ── Clinical notes (shared with the patient page) ── */}
      {canNotes && editingNotesId && items.find((a) => a.id === editingNotesId) && (
        <VisitNoteDialog
          visitId={editingNotesId}
          initialText={items.find((a) => a.id === editingNotesId)?.internalNotes || ""}
          onClose={() => setEditingNotesId(null)}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {/* ── New / edit visit (ticket #103) ── */}
      {formTarget && (
        <AppointmentFormPanel
          target={formTarget}
          canOverbook={canOverbook}
          locale={locale}
          onClose={() => setFormTarget(null)}
          onSaved={onFormSaved}
        />
      )}

      {/* ── Delete (soft): the visit can be restored from "Eliminadas" ── */}
      {deleting && (
        <ConfirmModal
          title={t.agenda.deleteTitle}
          message={t.agenda.deleteMessage}
          confirmLabel={t.agenda.deleteConfirm}
          variant="danger"
          isBusy={updatingId === deleting.id}
          onConfirm={() => void deleteVisit()}
          onCancel={() => setDeleting(null)}
        />
      )}

      {/* ── Restore into a taken slot: pick one of the nearest free times ── */}
      {restoring && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setRestoring(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-times-title"
            className="bg-white dark:bg-gray-950 rounded-xl shadow-lg w-full max-w-md p-6 border border-gray-200 dark:border-gray-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="restore-times-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              {t.agenda.alternativesTitle}
            </h3>
            <AlternativesPicker
              alternatives={restoring.alternatives}
              locale={locale}
              disabled={updatingId === restoring.visit.id}
              onPick={(slot) => void restoreVisit(restoring.visit, slot)}
            />
            <div className="flex justify-end">
              <button onClick={() => setRestoring(null)} className="btn-ghost px-5 py-2.5 text-sm font-semibold">
                {t.agenda.form.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminCitasPage() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<div className="p-12 text-center text-gray-400">{t.agenda.suspense}</div>}>
      <CitasContent />
    </Suspense>
  );
}
