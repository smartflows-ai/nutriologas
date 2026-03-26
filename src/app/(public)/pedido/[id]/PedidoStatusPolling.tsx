"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle, Clock, Truck, Package, XCircle } from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; class: string; icon: typeof CheckCircle }
> = {
  PENDING: {
    label: "Pendiente de pago",
    class: "text-yellow-600",
    icon: Clock,
  },
  PAID: {
    label: "Pagado",
    class: "text-green-600",
    icon: CheckCircle,
  },
  SHIPPED: {
    label: "Enviado",
    class: "text-blue-600",
    icon: Truck,
  },
  DELIVERED: {
    label: "Entregado",
    class: "text-purple-600",
    icon: Package,
  },
  CANCELLED: {
    label: "Cancelado",
    class: "text-red-600",
    icon: XCircle,
  },
};

interface PedidoStatusPollingProps {
  orderId: string;
  initialStatus: string;
}

export default function PedidoStatusPolling({
  orderId,
  initialStatus,
}: PedidoStatusPollingProps) {
  const [status, setStatus] = useState(initialStatus);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const StatusIcon = config.icon;

  // Fetch order status from API
  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/pedido/${orderId}`);
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      const newStatus = data.order?.status;

      if (newStatus && newStatus !== status) {
        setStatus(newStatus);
      }

      setLastChecked(new Date());
    } catch (error) {
    }
  };

  useEffect(() => {
    // Solo hacer polling si el pedido está en PENDING
    if (status !== "PENDING") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Configurar polling cada 5 segundos
    intervalRef.current = setInterval(() => {
      fetchStatus();
    }, 5000);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status, orderId]);

  // Primera verificación inmediata al montar el componente
  useEffect(() => {
    if (status === "PENDING") {
      fetchStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`flex items-center gap-2 ${config.class}`}>
      <StatusIcon size={20} />
      <span className="font-semibold">{config.label}</span>
      {status === "PENDING" && (
        <span className="text-xs text-gray-400 ml-2">
          Actualizado: {lastChecked.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
