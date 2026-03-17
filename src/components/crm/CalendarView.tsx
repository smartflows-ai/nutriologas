"use client";
// src/components/crm/CalendarView.tsx
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import { useState, useEffect } from "react";

interface CalStats { total: number; attended: number; cancelled: number; }

export default function CalendarView() {
  const [stats, setStats] = useState<CalStats>({ total: 0, attended: 0, cancelled: 0 });
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    // TODO: fetch from /api/calendar/events when Google Calendar is integrated
    // Por ahora muestra eventos de ejemplo
    const sampleEvents = [
      { id: "1", title: "Consulta - María G.", start: new Date(), backgroundColor: "#16a34a", borderColor: "#16a34a", extendedProps: { status: "attended" } },
      { id: "2", title: "Consulta - Carlos R.", start: new Date(Date.now() + 86400000), backgroundColor: "#16a34a", borderColor: "#16a34a", extendedProps: { status: "attended" } },
      { id: "3", title: "Cita cancelada", start: new Date(Date.now() + 172800000), backgroundColor: "#ef4444", borderColor: "#ef4444", extendedProps: { status: "cancelled" } },
    ];
    setEvents(sampleEvents);
    setStats({ total: 3, attended: 2, cancelled: 1 });
  }, []);

  const statCards = [
    { label: "Total citas", value: stats.total, color: "bg-blue-50 text-blue-700" },
    { label: "Atendidas", value: stats.attended, color: "bg-green-50 text-green-700" },
    { label: "Canceladas", value: stats.cancelled, color: "bg-red-50 text-red-700" },
    { label: "Tasa asistencia", value: stats.total > 0 ? `${Math.round((stats.attended / stats.total) * 100)}%` : "—", color: "bg-purple-50 text-purple-700" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="card text-center">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold px-2 py-1 rounded-lg inline-block ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Atendida</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Cancelada</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-400 inline-block" /> Pendiente</span>
      </div>

      {/* Calendar */}
      <div className="card p-4">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={esLocale}
          events={events}
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,dayGridWeek" }}
          height="auto"
          eventClick={(info) => alert(`${info.event.title}\nEstado: ${info.event.extendedProps.status}`)}
        />
      </div>
    </div>
  );
}
