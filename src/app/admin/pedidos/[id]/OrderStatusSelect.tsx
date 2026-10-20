"use client";
// src/app/admin/pedidos/[id]/OrderStatusSelect.tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, RefreshCw, AlertCircle } from "lucide-react";
import { useTranslation } from "@/i18n";
import { fill } from "@/lib/utils";


export default function OrderStatusSelect({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const { t } = useTranslation();
  const STATUSES = [
    { value: "PENDING", label: t.orderDetail.statusPending },
    { value: "PAID", label: t.orderDetail.statusPaid },
    { value: "SHIPPED", label: t.orderDetail.statusShipped },
    { value: "DELIVERED", label: t.orderDetail.statusDelivered },
    { value: "CANCELLED", label: t.orderDetail.statusCancelled },
  ];
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);
  const [notificationState, setNotificationState] = useState<{ title: string; message: string; type: "error" | "success" } | null>(null);
  const router = useRouter();

  const handleChange = async (newStatus: string) => {
    if (newStatus === status) return;
    if (newStatus === "CANCELLED" && !confirm(t.orderDetail.cancelConfirm)) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        setNotificationState({
          title: t.orderDetail.updateError,
          message: data.error ?? t.orderDetail.updateErrorFallback,
          type: "error"
        });
        return;
      }
      setStatus(newStatus);
      setNotificationState({
        title: t.orderDetail.updated,
        message: fill(t.orderDetail.updatedMsg, { status: STATUSES.find(s => s.value === newStatus)?.label ?? newStatus }),
        type: "success"
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800">
        <label className="text-xs font-semibold text-gray-400 pl-2">{t.orderDetail.statusLabel}</label>
        <div className="relative flex-1">
          <select
            value={status}
            onChange={(e) => handleChange(e.target.value)}
            disabled={saving}
            className="w-full bg-white dark:bg-gray-900 border-none rounded-xl py-2 px-3 text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 appearance-none pr-8 cursor-pointer shadow-sm"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
             {saving ? <RefreshCw size={14} className="animate-spin" /> : <AlertCircle size={14} />}
          </div>
        </div>
      </div>

       {/* Custom Notification Modal (Inline style simple) */}
       {notificationState && (
        <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg w-full max-w-sm p-8 text-center border border-gray-100 dark:border-gray-800">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${notificationState.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
              {notificationState.type === 'error' ? <X size={32} /> : <Check size={32} />}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{notificationState.title}</h3>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">{notificationState.message}</p>
            <button
              className="px-6 py-3 w-full text-sm font-semibold text-white bg-gray-900 dark:bg-gray-800 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-700 transition-all "
              onClick={() => setNotificationState(null)}
            >
              {t.integrationsUi.understood}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
