"use client";
// src/components/shop/CustomerAppointmentsList.tsx
import { useState } from "react";
import { Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, X, ChevronRight } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";

interface AppointmentData {
  id: string;
  appointmentDate: string;
  durationMinutes: number;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  notes: string | null;
  product: {
    id: string;
    name: string;
    price: number;
    images: string[];
    slug: string;
  };
}

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  PENDING: { label: "Pendiente de Confirmación", class: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
  CONFIRMED: { label: "Cita Confirmada", class: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300" },
  COMPLETED: { label: "Realizada / Completada", class: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" },
  CANCELLED: { label: "Cancelada", class: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300" },
  NO_SHOW: { label: "No Asistió", class: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

export default function CustomerAppointmentsList({
  initialAppointments,
}: {
  initialAppointments: AppointmentData[];
}) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas cancelar esta cita?")) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "CANCELLED" } : a))
        );
      }
    } catch (e) {
      console.error("Error cancelling appointment:", e);
    } finally {
      setCancellingId(null);
    }
  };

  if (appointments.length === 0) {
    return (
      <div className="card text-center py-20 px-4">
        <div className="w-16 h-16 bg-violet-50 dark:bg-violet-950/40 text-violet-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <CalendarIcon size={32} />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">No tienes citas agendadas</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto mb-6">
          Cuando reserves una consulta o servicio médico, podrás dar seguimiento a tu agenda aquí.
        </p>
        <Link href="/productos" className="btn-primary inline-flex items-center gap-2">
          Ver Servicios Disponibles
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {appointments.map((item) => {
        const d = new Date(item.appointmentDate);
        const dateStr = d.toLocaleDateString("es-MX", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const timeStr = d.toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const statusCfg = STATUS_MAP[item.status] || STATUS_MAP.PENDING;
        const canCancel = item.status === "PENDING" || item.status === "CONFIRMED";

        return (
          <div
            key={item.id}
            className="card p-6 border border-gray-100 dark:border-gray-800 hover:shadow-lg transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-950/50 border border-violet-100 dark:border-violet-900/40 flex flex-col items-center justify-center text-violet-600 dark:text-violet-400 flex-shrink-0">
                <CalendarIcon size={20} />
                <span className="text-[10px] font-bold mt-0.5">{d.getDate()} {d.toLocaleDateString("es-MX", { month: "short" })}</span>
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-bold text-gray-900 dark:text-white text-base">
                    {item.product.name}
                  </h4>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${statusCfg.class}`}>
                    {statusCfg.label}
                  </span>
                </div>

                <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                  <Clock size={13} /> {dateStr} a las {timeStr} hrs ({item.durationMinutes} min)
                </p>

                <p className="text-xs text-gray-500">
                  Costo: <span className="font-bold text-gray-800 dark:text-gray-200">{formatPrice(item.product.price)}</span>
                </p>

                {item.notes && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-800 mt-2">
                    <span className="font-semibold">Tus notas:</span> {item.notes}
                  </p>
                )}
              </div>
            </div>

            {canCancel && (
              <div className="w-full md:w-auto flex justify-end pt-3 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => handleCancel(item.id)}
                  disabled={cancellingId === item.id}
                  className="px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all"
                >
                  {cancellingId === item.id ? "Cancelando..." : "Cancelar Cita"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
