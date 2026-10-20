"use client";
// src/components/shop/CustomerAppointmentsList.tsx
import { useState } from "react";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { formatPrice, localeFor, fill } from "@/lib/utils";
import { useTranslation } from "@/i18n";
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

// Status colors are semantic (pending, confirmed, cancelled), so they stay fixed and do not follow the tenant theme.
const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  CONFIRMED: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  CANCELLED: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  NO_SHOW: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function CustomerAppointmentsList({
  initialAppointments,
}: {
  initialAppointments: AppointmentData[];
}) {
  const { t, lang } = useTranslation();
  const locale = localeFor(lang);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const STATUS_LABEL: Record<string, string> = {
    PENDING: t.myAppointments.statusPending,
    CONFIRMED: t.myAppointments.statusConfirmed,
    COMPLETED: t.myAppointments.statusCompleted,
    CANCELLED: t.myAppointments.statusCancelled,
    NO_SHOW: t.myAppointments.statusNoShow,
  };

  const handleCancel = async (id: string) => {
    if (!confirm(t.myAppointments.confirmCancel)) return;
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
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 text-primary rounded-xl flex items-center justify-center mx-auto mb-4">
          <CalendarIcon size={32} />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t.myAppointments.emptyTitle}</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto mb-6">{t.myAppointments.emptyDesc}</p>
        <Link href="/productos" className="btn-primary inline-flex items-center gap-2">
          {t.myAppointments.browseServices}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {appointments.map((item) => {
        const d = new Date(item.appointmentDate);
        const dateStr = d.toLocaleDateString(locale, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const timeStr = d.toLocaleTimeString(locale, {
          hour: "2-digit",
          minute: "2-digit",
        });
        const shortMonth = d.toLocaleDateString(locale, { month: "short" });

        const statusClass = STATUS_CLASS[item.status] || STATUS_CLASS.PENDING;
        const statusLabel = STATUS_LABEL[item.status] || STATUS_LABEL.PENDING;
        const canCancel = item.status === "PENDING" || item.status === "CONFIRMED";

        return (
          <div
            key={item.id}
            className="card p-6 border border-gray-100 dark:border-gray-800 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 border border-primary/10 dark:border-primary/40 flex flex-col items-center justify-center text-primary flex-shrink-0">
                <CalendarIcon size={20} />
                <span className="text-xs font-semibold mt-0.5">{d.getDate()} {shortMonth}</span>
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-base">
                    {item.product.name}
                  </h4>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusClass}`}>
                    {statusLabel}
                  </span>
                </div>

                <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <Clock size={13} /> {fill(t.booking.dateTimeValue, { date: dateStr, time: timeStr })} ({fill(t.booking.durationValue, { minutes: item.durationMinutes })})
                </p>

                <p className="text-xs text-gray-500">
                  {t.myAppointments.costLabel}:{" "}
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{formatPrice(item.product.price, locale)}</span>
                </p>

                {item.notes && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-800 mt-2">
                    <span className="font-semibold">{t.myAppointments.notesLabel}</span> {item.notes}
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
                  {cancellingId === item.id ? t.myAppointments.cancelling : t.myAppointments.cancel}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
