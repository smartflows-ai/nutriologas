"use client";
// src/components/crm/CalendarView.tsx
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import { useState, useCallback, useEffect, useRef } from "react";

interface CalStats { total: number; attended: number; cancelled: number; }

interface CalEvent {
  id: string;
  title: string;
  start: string | Date;
  end?: string | Date;
  allDay?: boolean;
  backgroundColor: string;
  borderColor: string;
  extendedProps: { status: string; description?: string; location?: string; htmlLink?: string };
}

type FilterStatus = "all" | "attended" | "pending" | "cancelled";

export default function CalendarView() {
  const [stats, setStats] = useState<CalStats>({ total: 0, attended: 0, cancelled: 0 });
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("all");
  // Store all fetched events so we can re-filter without a new network request
  const allEventsRef = useRef<any[]>([]);
  const successCbRef = useRef<((events: any[]) => void) | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Apply the current filter to the cached events and push them to FullCalendar
  const applyFilter = useCallback((events: any[], status: FilterStatus, cb?: (events: any[]) => void) => {
    const target = cb ?? successCbRef.current;
    if (!target) return;
    if (status === "all") {
      target(events);
    } else {
      target(events.filter((e: any) => e.extendedProps?.status === status));
    }
  }, []);

  // Wrapped in useCallback so the function reference is stable across renders.
  // Without this, FullCalendar sees a "new" event source every render → infinite loop.
  const fetchEvents = useCallback(async (
    fetchInfo: { start: Date; end: Date },
    successCallback: (events: any[]) => void,
    failureCallback: (error: Error) => void
  ) => {
    successCbRef.current = successCallback;
    try {
      const params = new URLSearchParams({
        start: fetchInfo.start.toISOString(),
        end: fetchInfo.end.toISOString(),
      });
      const res = await fetch(`/api/calendar/events?${params}`);
      const data = await res.json();
      if (data.error) { failureCallback(new Error(data.error)); setError(data.error); return; }
      setStats(data.stats ?? { total: 0, attended: 0, cancelled: 0 });
      setError(null);
      allEventsRef.current = data.events ?? [];
      // Use the current filter value via a ref-safe approach
      applyFilter(allEventsRef.current, filter, successCallback);
    } catch (e) {
      failureCallback(e as Error);
      setError("No se pudo conectar con Google Calendar");
    }
  }, [filter, applyFilter]); // filter in deps → new stable fn when filter changes → FullCalendar refetches

  const attendanceRate = stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0;

  const statCards = [
    { label: "Total citas", value: stats.total, icon: "📅", from: "from-blue-500", to: "to-blue-600" },
    { label: "Atendidas", value: stats.attended, icon: "✅", from: "from-green-500", to: "to-green-600" },
    { label: "Canceladas", value: stats.cancelled, icon: "❌", from: "from-red-500", to: "to-red-600" },
    { label: "Asistencia", value: `${attendanceRate}%`, icon: "📊", from: "from-purple-500", to: "to-purple-600" },
  ];

  const filterButtons: { status: FilterStatus; label: string; dot: string; ring: string }[] = [
    { status: "all",       label: "Todas",      dot: "bg-gray-400",   ring: "ring-gray-400" },
    { status: "attended",  label: "Atendidas",  dot: "bg-green-500",  ring: "ring-green-500" },
    { status: "pending",   label: "Pendientes", dot: "bg-amber-400",  ring: "ring-amber-400" },
    { status: "cancelled", label: "Canceladas", dot: "bg-red-500",    ring: "ring-red-500" },
  ];

  return (
    <div className="space-y-6">

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Content */}
      {!error && (
      <>
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl bg-gradient-to-br ${s.from} ${s.to} p-5 text-white shadow-lg flex flex-col gap-1`}
          >
            <span className="text-2xl">{s.icon}</span>
            <p className="text-3xl font-extrabold tracking-tight">{s.value}</p>
            <p className="text-xs font-medium opacity-80 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter buttons + Legend row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {filterButtons.map(({ status, label, dot, ring }) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                ${filter === status
                  ? `bg-white ring-2 ${ring} text-gray-800 shadow-sm border-transparent`
                  : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200"
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              {label}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs font-medium text-gray-500">
          {[
            { color: "bg-green-500", label: "Atendida" },
            { color: "bg-red-500", label: "Cancelada" },
            { color: "bg-amber-400", label: "Pendiente" },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${color} shadow-sm`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <style>{`
          .fc { font-family: inherit; }
          .fc-toolbar-title { font-size: 1.1rem !important; font-weight: 700; color: #111827; }
          .fc-button { background: #f3f4f6 !important; border: none !important; color: #374151 !important;
            border-radius: 8px !important; font-size: 0.78rem !important; font-weight: 600 !important;
            padding: 6px 12px !important; box-shadow: none !important; }
          .fc-button:hover { background: #e5e7eb !important; }
          .fc-button-active, .fc-button-primary:not(:disabled).fc-button-active { 
            background: var(--color-primary, #16a34a) !important; color: #fff !important; }
          .fc-today-button { background: var(--color-primary, #16a34a) !important; color: #fff !important; opacity: 1 !important; }
          .fc-daygrid-day.fc-day-today { background: #f0fdf4 !important; }
          .fc-col-header-cell { background: #f9fafb; padding: 8px 0 !important; }
          .fc-col-header-cell-cushion { font-size: 0.75rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
          .fc-event { border-radius: 6px !important; font-size: 0.75rem !important; font-weight: 500 !important; 
            padding: 2px 6px !important; cursor: pointer; }
          .fc-daygrid-day-number { font-size: 0.82rem; color: #374151; font-weight: 500; padding: 6px 8px !important; }
          .fc-toolbar { padding: 16px 20px !important; flex-wrap: wrap; gap: 8px !important; }
          .fc-toolbar-title { font-size: 0.95rem !important; }
          @media (max-width: 640px) {
            .fc-toolbar { padding: 10px 12px !important; }
            .fc-toolbar-title { font-size: 0.85rem !important; }
            .fc-button { font-size: 0.7rem !important; padding: 4px 8px !important; }
            .fc-col-header-cell-cushion { font-size: 0.65rem; }
            .fc-daygrid-day-number { font-size: 0.72rem; padding: 3px 4px !important; }
            .fc-timegrid-slot-label { font-size: 0.65rem !important; }
          }
        `}</style>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={isMobile ? "timeGridDay" : "dayGridMonth"}
          locale={esLocale}
          events={fetchEvents}
          headerToolbar={isMobile
            ? { left: "prev,next", center: "title", right: "timeGridDay,dayGridMonth" }
            : { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }
          }
          height={isMobile ? "60vh" : 650}
          eventClick={(info) => setSelected(info.event as unknown as CalEvent)}
        />
      </div>

      {/* Event detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-80 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
              style={{ backgroundColor: (selected as any).backgroundColor ?? "#16a34a" }}
            >
              📋
            </div>
            <h3 className="font-bold text-gray-900 text-lg leading-tight">{(selected as any).title}</h3>
            <p className="text-sm text-gray-500 capitalize">Estado: {(selected as any).extendedProps?.status}</p>
            <button
              onClick={() => setSelected(null)}
              className="mt-2 w-full rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
