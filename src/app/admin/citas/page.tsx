"use client";
// src/app/admin/citas/page.tsx
// Centralized Agenda & Scheduling Hub: one unified view with all appointments
// (native CRM bookings, WhatsApp reservations, and Google / Outlook Calendar events combined)
import { useState, useEffect, Suspense, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Phone,
  CheckCircle2,
  XCircle,
  Check,
  Search,
  MessageSquare,
  RefreshCw,
  Plug,
  ExternalLink,
} from "lucide-react";
import { formatPrice, localeFor, fill } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import Link from "next/link";

interface AppointmentItem {
  id: string;
  source?: "native" | "google" | "microsoft";
  tenantId: string;
  userId?: string;
  productId?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  appointmentDate: string;
  durationMinutes: number;
  notes: string | null;
  internalNotes?: string | null;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  createdAt: string;
  htmlLink?: string;
  product?: {
    id: string;
    name: string;
    price: number;
    durationMinutes: number | null;
    category: string | null;
  };
  user?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

// Status colors are semantic (pending, confirmed, cancelled), so they stay fixed and do not follow the tenant theme.
const STATUS_STYLE: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  PENDING:   { bg: "bg-amber-500/10",   text: "text-amber-500",   border: "border-amber-500/20",   dot: "bg-amber-400" },
  CONFIRMED: { bg: "bg-blue-500/10",    text: "text-blue-500",    border: "border-blue-500/20",    dot: "bg-blue-500" },
  COMPLETED: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/20", dot: "bg-emerald-500" },
  CANCELLED: { bg: "bg-rose-500/10",    text: "text-rose-500",    border: "border-rose-500/20",    dot: "bg-rose-400" },
  NO_SHOW:   { bg: "bg-gray-500/10",    text: "text-gray-400",    border: "border-gray-500/20",    dot: "bg-gray-400" },
};

/** Mini-calendar for interactive date navigation */
function MiniCalendar({
  appointments,
  selectedDate,
  onSelectDate,
}: {
  appointments: AppointmentItem[];
  selectedDate: string;
  onSelectDate: (d: string) => void;
}) {
  const { t, lang } = useTranslation();
  const locale = localeFor(lang);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  // Set of dates with appointments (YYYY-MM-DD based on local date)
  const appointmentDates = useMemo(() => {
    const dates = new Set<string>();
    appointments.forEach((a) => {
      const d = new Date(a.appointmentDate);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.add(`${y}-${m}-${day}`);
      if (a.appointmentDate.length >= 10) {
        dates.add(a.appointmentDate.slice(0, 10));
      }
    });
    return dates;
  }, [appointments]);

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  // Single-letter weekday headers in the active locale, starting on Sunday
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + i).toLocaleDateString(locale, { weekday: "narrow" })
  );

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

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
          const isToday =
            today.getFullYear() === viewYear &&
            today.getMonth() === viewMonth &&
            today.getDate() === day;

          return (
            <button
              key={idx}
              onClick={() => onSelectDate(isSelected ? "" : dateKey)}
              className={`relative h-8 w-8 mx-auto rounded-xl flex flex-col items-center justify-center text-xs font-medium transition-all ${
                isSelected
                  ? "bg-primary text-white font-semibold ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-900"
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

function CitasContent() {
  const { t, lang } = useTranslation();
  const locale = localeFor(lang);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [internalNoteDraft, setInternalNoteDraft] = useState("");
  const [hasCalendarIntegration, setHasCalendarIntegration] = useState(false);

  const STATUS_LABEL: Record<string, string> = {
    PENDING: t.agenda.statusPending,
    CONFIRMED: t.agenda.statusConfirmed,
    COMPLETED: t.agenda.statusCompleted,
    CANCELLED: t.agenda.statusCancelled,
    NO_SHOW: t.agenda.statusNoShow,
  };

  // Check if an external calendar is connected
  useEffect(() => {
    const now = new Date().toISOString();
    fetch(`/api/calendar/events?start=${now}&end=${now}`)
      .then((r) => r.json())
      .then((d) => setHasCalendarIntegration(!!d.hasExternalCalendar))
      .catch(() => {});
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments?limit=200`);
      const data = await res.json();
      if (Array.isArray(data)) setAppointments(data);
    } catch (e) {
      console.error("Error fetching appointments:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

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
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: newStatus as any } : a))
        );
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
        toast.error(d.error || t.agenda.toastUpdateError);
      }
    } catch {
      toast.error(t.agenda.toastUpdateErrorNet);
    } finally {
      setUpdatingId(null);
    }
  };

  const saveInternalNotes = async (id: string) => {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalNotes: internalNoteDraft }),
      });
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, internalNotes: internalNoteDraft } : a))
        );
        setEditingNotesId(null);
        toast.success(t.agenda.toastNotesSaved);
      }
    } catch {
      toast.error(t.agenda.toastNotesError);
    }
  };

  // KPI counts
  const totalCount = appointments.length;
  const pendingCount = appointments.filter((a) => a.status === "PENDING").length;
  const confirmedCount = appointments.filter((a) => a.status === "CONFIRMED").length;
  const completedCount = appointments.filter((a) => a.status === "COMPLETED").length;
  const cancelledCount = appointments.filter((a) => a.status === "CANCELLED" || a.status === "NO_SHOW").length;

  // Filtered list
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      // Status filter
      if (activeTab !== "ALL" && appt.status !== activeTab) return false;

      // Date filter
      if (selectedDate) {
        const d = new Date(appt.appointmentDate);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const dateKey = `${y}-${m}-${day}`;
        const dateIso = appt.appointmentDate.slice(0, 10);
        if (dateKey !== selectedDate && dateIso !== selectedDate) return false;
      }

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = (appt.customerName || appt.user?.name || "").toLowerCase().includes(term);
        const matchPhone = (appt.customerPhone || "").includes(term);
        const matchProduct = (appt.product?.name || "").toLowerCase().includes(term);
        const matchNotes = (appt.notes || "").toLowerCase().includes(term);
        if (!matchName && !matchPhone && !matchProduct && !matchNotes) return false;
      }

      return true;
    });
  }, [appointments, activeTab, selectedDate, searchTerm]);

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
        <div className="flex items-center gap-2">
          {hasCalendarIntegration ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-primary text-xs font-semibold border border-gray-200 dark:border-gray-800">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {t.agenda.gcalSynced}
            </span>
          ) : (
            <Link
              href="/admin/apps"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold transition-colors"
            >
              <span>{t.agenda.connectGcal}</span>
            </Link>
          )}

          <button
            onClick={fetchAppointments}
            title={t.agenda.reload}
            aria-label={t.agenda.reload}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
          <Link
            href="/admin/apps"
            className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plug size={14} className="text-primary" />
            {t.agenda.integrations}
          </Link>
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
        <div className="lg:col-span-4 xl:col-span-3 sticky top-6">
          <MiniCalendar
            appointments={appointments}
            selectedDate={selectedDate}
            onSelectDate={(dateKey) => setSelectedDate(dateKey)}
          />

          {selectedDate && (
            <div className="mt-3 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 border border-primary/10 dark:border-primary/40 text-xs text-primary flex items-center justify-between">
              <span className="font-medium">{fill(t.agenda.filteredBy, { date: selectedDateLabel })}</span>
              <button onClick={() => setSelectedDate("")} className="font-semibold underline text-primary hover:text-secondary">
                {t.agenda.clear}
              </button>
            </div>
          )}
        </div>

        {/* Right column: filters + unified appointments list */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {/* Status tabs + search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { id: "ALL", label: t.agenda.tabAll, count: totalCount },
                { id: "PENDING", label: t.agenda.tabPending, count: pendingCount },
                { id: "CONFIRMED", label: t.agenda.tabConfirmed, count: confirmedCount },
                { id: "COMPLETED", label: t.agenda.tabCompleted, count: completedCount },
                { id: "CANCELLED", label: t.agenda.tabCancelled, count: cancelledCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                    activeTab === tab.id
                      ? "bg-primary text-white "
                      : "bg-white dark:bg-gray-900 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-100 dark:border-gray-800"
                  }`}
                >
                  {tab.label} {tab.count > 0 && `(${tab.count})`}
                </button>
              ))}
            </div>
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                placeholder={t.agenda.searchPlaceholder}
                aria-label={t.agenda.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
              {filteredAppointments.map((appt) => {
                const dateObj = new Date(appt.appointmentDate);
                const dateStr = dateObj.toLocaleDateString(locale, {
                  weekday: "short", year: "numeric", month: "short", day: "numeric",
                });
                const timeStr = dateObj.toLocaleTimeString(locale, {
                  hour: "2-digit", minute: "2-digit", hour12: true,
                });
                const style = STATUS_STYLE[appt.status] || STATUS_STYLE.PENDING;
                const statusLabel = STATUS_LABEL[appt.status] || STATUS_LABEL.PENDING;
                const patientName = appt.customerName || appt.user?.name || t.agenda.patientFallback;
                const patientPhone = appt.customerPhone;
                const isExternal = appt.source === "google" || appt.source === "microsoft";

                return (
                  <div
                    key={appt.id}
                    className="card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-gray-100 dark:border-gray-800/80 rounded-xl bg-white dark:bg-gray-900 transition-all"
                  >
                    {/* Date badge */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 border border-primary/10 dark:border-primary/40 flex flex-col items-center justify-center text-primary">
                        <span className="text-[9px] font-semibold ">
                          {dateObj.toLocaleDateString(locale, { month: "short" })}
                        </span>
                        <span className="text-xl font-semibold leading-none">{dateObj.getDate()}</span>
                        <span className="text-[9px] font-semibold">{dateObj.getFullYear()}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} className="text-primary" />
                          <span className="font-semibold text-gray-900 dark:text-white text-sm">{timeStr}</span>
                          <span className="text-xs text-gray-400">({fill(t.productUi.minutesShort, { minutes: appt.durationMinutes })})</span>
                        </div>
                        <span className="text-xs text-gray-500 capitalize">{dateStr}</span>
                      </div>
                    </div>

                    {/* Patient + service info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {appt.product?.name ?? t.agenda.consultFallback}
                        </h3>

                        {/* Integration source badge */}
                        {appt.source === "google" && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                            </svg>
                            Google Calendar
                          </span>
                        )}
                        {appt.source === "microsoft" && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                            Outlook
                          </span>
                        )}

                        {/* Price badge for native consultations */}
                        {!isExternal && appt.product?.price ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                            {formatPrice(appt.product.price, locale)}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                        <span className="flex items-center gap-1 font-semibold text-gray-800 dark:text-gray-200">
                          <User size={12} className="text-gray-400" />
                          {patientName}
                        </span>
                        {patientPhone ? (
                          <a
                            href={`https://wa.me/${patientPhone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline font-semibold"
                          >
                            <Phone size={12} />
                            {patientPhone}
                          </a>
                        ) : null}
                        {appt.user?.email && !appt.user.email.includes("@booking.local") ? (
                          <span className="text-gray-400">{appt.user.email}</span>
                        ) : null}
                      </div>

                      {appt.notes && (
                        <p className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/40 px-2.5 py-1.5 rounded-xl mt-1 border border-gray-100 dark:border-gray-800">
                          <b className="font-semibold text-gray-700 dark:text-gray-300">{t.agenda.reason}</b> {appt.notes}
                        </p>
                      )}
                      {appt.internalNotes && (
                        <p className="text-xs text-primary bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 rounded-xl mt-1 border border-primary/10 dark:border-primary/30">
                          <b className="font-semibold">{t.agenda.clinicalNotes}</b> {appt.internalNotes}
                        </p>
                      )}
                    </div>

                    {/* Status + actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0 w-full sm:w-auto">
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          {statusLabel}
                        </span>
                        {!isExternal && (
                          <button
                            onClick={() => {
                              setEditingNotesId(appt.id);
                              setInternalNoteDraft(appt.internalNotes || "");
                            }}
                            className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                          >
                            <MessageSquare size={12} />
                            {appt.internalNotes ? t.agenda.edit : t.agenda.notes}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 justify-end">
                        {/* External event direct link */}
                        {isExternal && appt.htmlLink && (
                          <a
                            href={appt.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                          >
                            <span>{t.agenda.openCalendar}</span>
                            <ExternalLink size={12} />
                          </a>
                        )}

                        {/* Native appointment status buttons */}
                        {!isExternal && appt.status === "PENDING" && (
                          <>
                            <button
                              disabled={updatingId === appt.id}
                              onClick={() => updateStatus(appt.id, "CONFIRMED")}
                              className="px-3 py-1.5 rounded-xl bg-primary hover:bg-secondary text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition-all disabled:opacity-50"
                            >
                              <Check size={13} />
                              {t.agenda.confirm}
                            </button>
                            <button
                              disabled={updatingId === appt.id}
                              onClick={() => updateStatus(appt.id, "CANCELLED")}
                              className="px-2.5 py-1.5 rounded-xl text-rose-500 text-xs hover:underline transition-all disabled:opacity-50"
                            >
                              {t.agenda.cancel}
                            </button>
                          </>
                        )}
                        {!isExternal && appt.status === "CONFIRMED" && (
                          <>
                            <button
                              disabled={updatingId === appt.id}
                              onClick={() => updateStatus(appt.id, "COMPLETED")}
                              className="px-3 py-1.5 rounded-xl bg-primary hover:opacity-90 text-white font-semibold text-xs flex items-center gap-1 transition-all disabled:opacity-50"
                            >
                              <CheckCircle2 size={13} />
                              {t.agenda.attended}
                            </button>
                            <button
                              disabled={updatingId === appt.id}
                              onClick={() => updateStatus(appt.id, "NO_SHOW")}
                              className="px-2 py-1.5 rounded-xl text-gray-500 text-xs hover:underline transition-all disabled:opacity-50"
                            >
                              {t.agenda.noShow}
                            </button>
                            <button
                              disabled={updatingId === appt.id}
                              onClick={() => updateStatus(appt.id, "CANCELLED")}
                              className="px-2 py-1.5 rounded-xl text-rose-500 text-xs hover:underline transition-all disabled:opacity-50"
                            >
                              {t.agenda.cancel}
                            </button>
                          </>
                        )}
                        {!isExternal && (appt.status === "COMPLETED" || appt.status === "CANCELLED" || appt.status === "NO_SHOW") && (
                          <button
                            disabled={updatingId === appt.id}
                            onClick={() => updateStatus(appt.id, "CONFIRMED")}
                            className="px-2.5 py-1 rounded-lg text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-50"
                          >
                            {t.agenda.reopen}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Clinical notes modal ── */}
      {editingNotesId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full p-6 shadow-lg border border-gray-100 dark:border-gray-800 animate-in ">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white text-base flex items-center gap-2">
                <MessageSquare size={18} className="text-primary" />
                {t.agenda.notesModalTitle}
              </h3>
              <button
                onClick={() => setEditingNotesId(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={t.common.close}
              >
                <XCircle size={18} />
              </button>
            </div>
            <div className="py-4 space-y-2">
              <p className="text-xs text-gray-500">{t.agenda.notesPrivate}</p>
              <textarea
                rows={5}
                value={internalNoteDraft}
                onChange={(e) => setInternalNoteDraft(e.target.value)}
                placeholder={t.agenda.notesPlaceholder}
                className="w-full text-xs p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:bg-white dark:focus:bg-gray-900 text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setEditingNotesId(null)} className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors">
                {t.agenda.cancel}
              </button>
              <button onClick={() => saveInternalNotes(editingNotesId)} className="btn-primary text-xs px-5 py-2">
                {t.agenda.save}
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
