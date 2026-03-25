"use client";
// src/app/admin/pedidos/[id]/OrderStatusSelect.tsx
import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = [
  { value: "PENDING",   label: "Pendiente" },
  { value: "PAID",      label: "Pagado" },
  { value: "SHIPPED",   label: "Enviado" },
  { value: "DELIVERED",  label: "Entregado" },
  { value: "CANCELLED", label: "Cancelado" },
];

export default function OrderStatusSelect({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleChange = async (newStatus: string) => {
    if (newStatus === status) return;
    if (newStatus === "CANCELLED" && !confirm("¿Cancelar este pedido? Se restaurará el stock si estaba pendiente.")) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Error al actualizar");
        return;
      }
      setStatus(newStatus);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-gray-500 font-medium">Status:</label>
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="input py-2 px-3 text-sm w-auto"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      {saving && <span className="text-xs text-gray-400">Guardando...</span>}
    </div>
  );
}
