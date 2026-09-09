// src/app/(public)/pedido/[id]/page.tsx
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Clock, Truck, Package, XCircle } from "lucide-react";
import PedidoStatusPolling from "./PedidoStatusPolling";
import { PrintButton } from "@/components/order/PrintButton";
import { DownloadTicketButton } from "@/components/order/DownloadTicketButton";
import { getTranslationServer } from "@/i18n/server";
import { Translations } from "@/i18n/types";

const getStatusConfig = (t: Translations): Record<string, { label: string; class: string; icon: typeof CheckCircle }> => ({
  PENDING: {
    label: t.storefront.orders.status.pending,
    class: "text-yellow-600",
    icon: Clock,
  },
  PAID: { label: t.storefront.orders.status.paid, class: "text-green-600", icon: CheckCircle },
  SHIPPED: { label: t.storefront.orders.status.shipped, class: "text-blue-600", icon: Truck },
  DELIVERED: { label: t.storefront.orders.status.delivered, class: "text-purple-600", icon: Package },
  CANCELLED: { label: t.storefront.orders.status.cancelled, class: "text-red-600", icon: XCircle },
});


const getPaymentLabels = (t: Translations) => ({
  CARD_CONEKTA: t.storefront.checkout.creditCard,
  OXXO_CONEKTA: t.storefront.checkout.oxxo,
  PAYPAL: "PayPal",
});

export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; print?: string }>;
}) {
  const session = await getAppSession();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const { success, print } = await searchParams;
  const isJustPaid = success === "true";
  const isPrintMode = print === "true";
  const t = getTranslationServer();

  const order = await prisma.order.findFirst({
    where: { id, userId: session.user.id },
    include: {
      items: {
        include: {
          product: { select: { name: true, images: true, slug: true } },
        },
      },
    },
  });

  if (!order) notFound();

  const statusConfig = getStatusConfig(t);
  const s = statusConfig[order.status] ?? statusConfig.PENDING;
  const StatusIcon = s.icon;

  return (
    <div
      className={`max-w-3xl mx-auto px-4 py-10 ${isPrintMode ? "print:p-0 print:m-0 print:max-w-none" : ""}`}
    >
      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-area, #printable-area * {
            visibility: visible;
          }
          #printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .card {
            box-shadow: none !important;
            border: 1px solid #ddd !important;
          }
        }
      `}</style>

      {/* Print button - hidden in print mode */}
      {!isPrintMode && (
        <div className="flex justify-end mb-4 no-print">
          <PrintButton variant="default" />
        </div>
      )}

      {/* Success banner */}
      {isJustPaid && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-8 flex items-center gap-3 no-print">
          <CheckCircle className="text-green-500 flex-shrink-0" size={24} />
          <div>
            <p className="font-semibold text-green-800">
              {t.storefront.orders.successPayment}
            </p>
            <p className="text-green-600 text-sm">
              {t.storefront.orders.processingOrder}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        id="printable-area"
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t.storefront.orders.orderHash}{order.id.slice(0, 8)}
          </h1>
          <p className="text-gray-500 text-sm">{formatDate(order.createdAt)}</p>
        </div>
        {!isPrintMode && (
          <PedidoStatusPolling
            orderId={order.id}
            initialStatus={order.status}
          />
        )}
      </div>

      {/* Products */}
      <div className="card mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">{t.storefront.orders.products}</h2>
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
          <span className="font-semibold text-gray-900">{t.storefront.cart.total}</span>
          <span className="font-bold text-primary text-lg">
            {formatPrice(order.total)}
          </span>
        </div>
      </div>

      {/* Payment info */}
      <div className="card mb-8">
        <h2 className="font-semibold text-gray-900 mb-3">
          {t.storefront.orders.paymentInfo}
        </h2>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-gray-500">{t.storefront.orders.method}</span>
          <span className="text-gray-900">
            {order.paymentMethod
              ? (getPaymentLabels(t)[order.paymentMethod] ?? order.paymentMethod)
              : "—"}
          </span>
          <span className="text-gray-500">{t.storefront.orders.reference}</span>
          <span className="font-mono text-xs text-gray-600">
            {order.paymentReference ?? "—"}
          </span>
        </div>
      </div>

      {/* OXXO Payment Instructions - Show for pending OXXO payments */}
      {order.paymentMethod === "OXXO_CONEKTA" && order.status === "PENDING" && (
        <div className="card mb-8 bg-yellow-50 border-yellow-200 no-print">
          <h2 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
            <Clock size={18} />
            {t.storefront.orders.oxxoInstructions}
          </h2>
          <ol className="text-sm text-yellow-700 space-y-2 list-decimal list-inside mb-4">
            <li>{t.storefront.orders.printTicket}</li>
            <li>{t.storefront.orders.payAtOxxo}</li>
            <li>{t.storefront.orders.cashPayment}</li>
            <li>{t.storefront.orders.activateAfterPayment}</li>
          </ol>
          <p className="text-xs text-yellow-600">
            {t.storefront.orders.expireWarning}
          </p>
          <div className="mt-4 flex gap-2">
            <DownloadTicketButton />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 no-print">
        <Link href="/productos" className="btn-primary text-center flex-1">
          {t.storefront.cart.continueShopping}
        </Link>
        <Link href="/mis-pedidos" className="btn-ghost text-center flex-1">
          {t.storefront.orders.viewMyOrders}
        </Link>
      </div>
    </div>
  );
}
