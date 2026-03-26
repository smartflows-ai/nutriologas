// src/app/admin/pedidos/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Eye } from "lucide-react";
import Pagination from "@/components/admin/Pagination";

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  PENDING:   { label: "Pendiente",  class: "bg-yellow-100 text-yellow-700" },
  PAID:      { label: "Pagado",     class: "bg-green-100 text-green-700" },
  SHIPPED:   { label: "Enviado",    class: "bg-blue-100 text-blue-700" },
  DELIVERED: { label: "Entregado",  class: "bg-purple-100 text-purple-700" },
  CANCELLED: { label: "Cancelado",  class: "bg-red-100 text-red-700" },
};

const PAYMENT_LABELS: Record<string, string> = {
  CARD_CONEKTA: "Tarjeta",
  OXXO_CONEKTA: "OXXO",
  PAYPAL: "PayPal",
};

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const tenantId = (session!.user as any).tenantId as string;
  const params = await searchParams;
  const statusFilter = params.status;
  const currentPage = parseInt(params.page || "1");
  const pageSize = 10;

  const where = {
    tenantId,
    ...(statusFilter && statusFilter !== "ALL" ? { status: statusFilter as any } : {}),
  };

  const totalFilteredCount = await prisma.order.count({ where });
  const totalPages = Math.ceil(totalFilteredCount / pageSize);

  const orders = await prisma.order.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
      items: { include: { product: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  });

  const counts = await prisma.order.groupBy({
    by: ["status"],
    where: { tenantId },
    _count: true,
  });
  const totalCount = counts.reduce((s, c) => s + c._count, 0);

  const filters = [
    { value: "ALL", label: "Todos", count: totalCount },
    ...Object.entries(STATUS_LABELS).map(([value, { label }]) => ({
      value,
      label,
      count: counts.find((c) => c.status === value)?._count ?? 0,
    })),
  ];

  const activeFilter = statusFilter || "ALL";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
        <p className="text-gray-500 text-sm">{totalCount} pedidos en total</p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map((f) => (
          <Link
            key={f.value}
            href={f.value === "ALL" ? "/admin/pedidos" : `/admin/pedidos?status=${f.value}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === f.value
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label} ({f.count})
          </Link>
        ))}
      </div>

      {/* Mobile: card list */}
      <div className="md:hidden space-y-3">
        {orders.map((order) => {
          const s = STATUS_LABELS[order.status] ?? { label: order.status, class: "bg-gray-100 text-gray-600" };
          return (
            <Link key={order.id} href={`/admin/pedidos/${order.id}`} className="card block">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-gray-400">#{order.id.slice(0, 8)}</span>
                <span className={`badge text-xs ${s.class}`}>{s.label}</span>
              </div>
              <p className="font-semibold text-gray-900 text-sm">{order.user.name ?? order.user.email}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">
                  {order.items.length} producto(s) &middot; {formatDate(order.createdAt)}
                </span>
                <span className="font-bold text-primary text-sm">{formatPrice(order.total)}</span>
              </div>
            </Link>
          );
        })}
        {orders.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">Sin pedidos.</p>}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Pedido", "Cliente", "Productos", "Total", "Método", "Estado", "Fecha", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order) => {
              const s = STATUS_LABELS[order.status] ?? { label: order.status, class: "bg-gray-100 text-gray-600" };
              return (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">#{order.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{order.user.name ?? order.user.email}</p>
                    <p className="text-xs text-gray-400">{order.user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {order.items.slice(0, 2).map((i) => i.product.name).join(", ")}
                    {order.items.length > 2 && ` +${order.items.length - 2}`}
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary">{formatPrice(order.total)}</td>
                  <td className="px-4 py-3 text-gray-500">{order.paymentMethod ? PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod : "—"}</td>
                  <td className="px-4 py-3"><span className={`badge ${s.class}`}>{s.label}</span></td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/pedidos/${order.id}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary transition-colors inline-flex">
                      <Eye size={16} />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Sin pedidos.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination 
        currentPage={currentPage}
        totalPages={totalPages}
        baseUrl="/admin/pedidos"
        searchParams={statusFilter ? { status: statusFilter } : {}}
      />
    </div>
  );
}
