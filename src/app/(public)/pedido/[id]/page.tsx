// src/app/(public)/pedido/[id]/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Clock, Truck, Package, XCircle } from "lucide-react";
import PedidoStatusPolling from "./PedidoStatusPolling";

const STATUS_CONFIG: Record<
  string,
  { label: string; class: string; icon: typeof CheckCircle }
> = {
  PENDING: {
    label: "Pendiente de pago",
    class: "text-yellow-600",
    icon: Clock,
  },
  PAID: { label: "Pagado", class: "text-green-600", icon: CheckCircle },
  SHIPPED: { label: "Enviado", class: "text-blue-600", icon: Truck },
  DELIVERED: { label: "Entregado", class: "text-purple-600", icon: Package },
  CANCELLED: { label: "Cancelado", class: "text-red-600", icon: XCircle },
};

const PAYMENT_LABELS: Record<string, string> = {
  CARD_CONEKTA: "Tarjeta de crédito/débito",
  OXXO_CONEKTA: "OXXO Pay",
  PAYPAL: "PayPal",
};

export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const { success } = await searchParams;
  const isJustPaid = success === "true";

  const order = await prisma.order.findFirst({
    where: { id, userId: session.user.id! },
    include: {
      items: {
        include: {
          product: { select: { name: true, images: true, slug: true } },
        },
      },
    },
  });

  if (!order) notFound();

  const s = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PENDING;
  const StatusIcon = s.icon;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Success banner */}
      {isJustPaid && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8 flex items-center gap-3">
          <CheckCircle className="text-green-500 flex-shrink-0" size={24} />
          <div>
            <p className="font-semibold text-green-800">
              ¡Pago recibido exitosamente!
            </p>
            <p className="text-green-600 text-sm">
              Tu pedido está siendo procesado.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Pedido #{order.id.slice(0, 8)}
          </h1>
          <p className="text-gray-500 text-sm">{formatDate(order.createdAt)}</p>
        </div>
        <PedidoStatusPolling orderId={order.id} initialStatus={order.status} />
      </div>

      {/* Products */}
      <div className="card mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Productos</h2>
        <div className="divide-y divide-gray-100">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 py-3">
              <div className="w-14 h-14 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                {item.product.images[0] ? (
                  <img
                    src={item.product.images[0]}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <Package size={20} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">
                  {item.product.name}
                </p>
                <p className="text-xs text-gray-400">
                  {formatPrice(item.unitPrice)} &times; {item.quantity}
                </p>
              </div>
              <span className="font-semibold text-gray-900 text-sm flex-shrink-0">
                {formatPrice(item.unitPrice * item.quantity)}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-200 mt-2 pt-4 flex justify-between">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="font-bold text-primary text-lg">
            {formatPrice(order.total)}
          </span>
        </div>
      </div>

      {/* Payment info */}
      <div className="card mb-8">
        <h2 className="font-semibold text-gray-900 mb-3">
          Información de pago
        </h2>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-gray-500">Método</span>
          <span className="text-gray-900">
            {order.paymentMethod
              ? (PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod)
              : "—"}
          </span>
          <span className="text-gray-500">Referencia</span>
          <span className="font-mono text-xs text-gray-600">
            {order.paymentReference ?? "—"}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/productos" className="btn-primary text-center flex-1">
          Seguir comprando
        </Link>
        <Link href="/mis-pedidos" className="btn-ghost text-center flex-1">
          Ver mis pedidos
        </Link>
      </div>
    </div>
  );
}
