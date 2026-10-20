// src/app/admin/pedidos/[id]/page.tsx
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/utils";
import { getTranslationServer } from "@/i18n/server";
import { getLocaleServer } from "@/i18n/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import OrderStatusSelect from "./OrderStatusSelect";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAppSession();
  const tenantId = session!.user.tenantId;
  const { id } = await params;
  const locale = getLocaleServer();
  const t = getTranslationServer();

  const order = await prisma.order.findFirst({
    where: { id, tenantId },
    include: {
      user: { select: { name: true, email: true } },
      items: { include: { product: { select: { name: true, images: true } } } },
    },
  });

  if (!order) notFound();

  const STATUS_LABELS: Record<string, { label: string; class: string }> = {
    PENDING:   { label: t.orderDetail.statusPending,   class: "bg-yellow-100 text-yellow-700" },
    PAID:      { label: t.orderDetail.statusPaid,      class: "bg-green-100 text-green-700" },
    SHIPPED:   { label: t.orderDetail.statusShipped,   class: "bg-blue-100 text-blue-700" },
    DELIVERED: { label: t.orderDetail.statusDelivered, class: "bg-purple-100 text-purple-700" },
    CANCELLED: { label: t.orderDetail.statusCancelled, class: "bg-red-100 text-red-700" },
  };

  const PAYMENT_LABELS: Record<string, string> = {
    CARD_CONEKTA: t.orderDetail.cardMethod,
    OXXO_CONEKTA: t.orderDetail.oxxoMethod,
    PAYPAL: "PayPal",
  };

  const s = STATUS_LABELS[order.status] ?? { label: order.status, class: "bg-gray-100 text-gray-600" };

  return (
    <div>
      <Link href="/admin/pedidos" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary mb-6">
        <ArrowLeft size={16} /> {t.orderDetail.back}
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2.5">
            <ShoppingBag className="text-primary" size={26} />
            {t.orderDetail.orderWord} #{order.id.slice(0, 8)}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{formatDate(order.createdAt, locale)}</p>
        </div>
        <OrderStatusSelect orderId={order.id} currentStatus={order.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order items */}
        <div className="lg:col-span-2 card">
          <h2 className="font-semibold text-gray-900 mb-4">{t.orderDetail.products}</h2>
          <div className="divide-y divide-gray-100">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 py-3">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.product.images[0] ? (
                    <img src={item.product.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-400 text-xs">IMG</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{item.product.name}</p>
                  <p className="text-xs text-gray-400">
                    {formatPrice(item.unitPrice, locale)} &times; {item.quantity}
                  </p>
                </div>
                <span className="font-semibold text-gray-900 text-sm">
                  {formatPrice(item.unitPrice * item.quantity, locale)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 mt-2 pt-4 flex justify-between">
            <span className="font-semibold text-gray-900">{t.orderDetail.total}</span>
            <span className="font-semibold text-primary text-lg">{formatPrice(order.total, locale)}</span>
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3">{t.orderDetail.customer}</h2>
            <p className="text-sm font-medium text-gray-900">{order.user.name ?? "—"}</p>
            <p className="text-sm text-gray-500">{order.user.email}</p>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3">{t.orderDetail.payment}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t.orderDetail.status}</span>
                <span className={`badge text-xs ${s.class}`}>{s.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t.orderDetail.method}</span>
                <span className="text-gray-900">{order.paymentMethod ? PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod : "—"}</span>
              </div>
              {order.paymentReference && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t.orderDetail.reference}</span>
                  <span className="font-mono text-xs text-gray-600">{order.paymentReference.slice(0, 16)}</span>
                </div>
              )}
              {order.conektaChargeId && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t.orderDetail.chargeId}</span>
                  <span className="font-mono text-xs text-gray-600">{order.conektaChargeId.slice(0, 16)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
