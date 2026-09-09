// src/app/(public)/mis-pedidos/page.tsx
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Package } from "lucide-react";

import { getTranslationServer } from "@/i18n/server";
import { Translations } from "@/i18n/types";

const getStatusLabels = (t: Translations) => ({
  PENDING:   { label: t.storefront.orders.status.pending,  class: "bg-yellow-100 text-yellow-700" },
  PAID:      { label: t.storefront.orders.status.paid,     class: "bg-green-100 text-green-700" },
  SHIPPED:   { label: t.storefront.orders.status.shipped,    class: "bg-blue-100 text-blue-700" },
  DELIVERED: { label: t.storefront.orders.status.delivered,  class: "bg-purple-100 text-purple-700" },
  CANCELLED: { label: t.storefront.orders.status.cancelled,  class: "bg-red-100 text-red-700" },
});

export default async function MisPedidosPage() {
  const session = await getAppSession();
  if (!session?.user) redirect("/login?callbackUrl=/mis-pedidos");

  const tenantId = session.user.tenantId;

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id, tenantId },
    include: {
      items: { include: { product: { select: { name: true, images: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const t = getTranslationServer();
  const statusLabels = getStatusLabels(t);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{t.storefront.orders.title}</h1>

      {orders.length === 0 ? (
        <div className="text-center py-20">
          <Package size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-6">{t.storefront.orders.emptyState}</p>
          <Link href="/productos" className="btn-primary">{t.storefront.cart.viewProducts}</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const s = statusLabels[order.status as keyof typeof statusLabels] ?? { label: order.status, class: "bg-gray-100 text-gray-600" };
            return (
              <Link key={order.id} href={`/pedido/${order.id}`} className="card block hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-gray-400">#{order.id.slice(0, 8)}</span>
                  <span className={`badge text-xs ${s.class}`}>{s.label}</span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  {order.items.slice(0, 3).map((item) => (
                    <div key={item.id} className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {item.product.images[0] ? (
                        <img src={item.product.images[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Package size={14} />
                        </div>
                      )}
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <span className="text-xs text-gray-400">+{order.items.length - 3} {t.storefront.orders.more}</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{formatDate(order.createdAt)}</span>
                  <span className="font-bold text-primary">{formatPrice(order.total)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
