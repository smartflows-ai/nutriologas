// src/app/(public)/mis-pedidos/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Package } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  PENDING:   { label: "Pendiente",  class: "bg-yellow-100 text-yellow-700" },
  PAID:      { label: "Pagado",     class: "bg-green-100 text-green-700" },
  SHIPPED:   { label: "Enviado",    class: "bg-blue-100 text-blue-700" },
  DELIVERED: { label: "Entregado",  class: "bg-purple-100 text-purple-700" },
  CANCELLED: { label: "Cancelado",  class: "bg-red-100 text-red-700" },
};

export default async function MisPedidosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/mis-pedidos");

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id! },
    include: {
      items: { include: { product: { select: { name: true, images: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Mis pedidos</h1>

      {orders.length === 0 ? (
        <div className="text-center py-20">
          <Package size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-6">Aún no tienes pedidos</p>
          <Link href="/productos" className="btn-primary">Ver productos</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const s = STATUS_LABELS[order.status] ?? { label: order.status, class: "bg-gray-100 text-gray-600" };
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
                    <span className="text-xs text-gray-400">+{order.items.length - 3} más</span>
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
