// src/app/admin/dashboard/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { ShoppingBag, Users, Star, TrendingUp } from "lucide-react";
import SalesChart from "@/components/crm/SalesChart";

async function getDashboardData(tenantId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalOrders = await prisma.order.count({ where: { tenantId, status: "PAID" } });
  const monthOrders = await prisma.order.findMany({ where: { tenantId, status: "PAID", createdAt: { gte: monthStart } } });
  const totalCustomers = await prisma.user.count({ where: { tenantId, role: "CUSTOMER" } });
  const newCustomers = await prisma.user.count({ where: { tenantId, role: "CUSTOMER", createdAt: { gte: monthStart } } });
  const reviews = await prisma.review.aggregate({ where: { tenantId }, _avg: { rating: true }, _count: true });
  const recentOrders = await prisma.order.findMany({
    where: { tenantId, status: "PAID" },
    include: { user: { select: { name: true, email: true } }, items: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const salesData = await prisma.order.findMany({
    where: { tenantId, status: "PAID", createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    select: { total: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const monthRevenue = monthOrders.reduce((s, o) => s + o.total, 0);

  return { totalOrders, monthRevenue, monthOrderCount: monthOrders.length, totalCustomers, newCustomers, avgRating: reviews._avg.rating, reviewCount: reviews._count, recentOrders, salesData };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const tenantId = (session!.user as any).tenantId as string;
  const data = await getDashboardData(tenantId);

  const metrics = [
    { label: "Ventas este mes", value: formatPrice(data.monthRevenue), sub: `${data.monthOrderCount} pedidos`, icon: TrendingUp, color: "bg-green-50 text-green-600" },
    { label: "Total clientes", value: data.totalCustomers.toString(), sub: `+${data.newCustomers} este mes`, icon: Users, color: "bg-blue-50 text-blue-600" },
    { label: "Total pedidos", value: data.totalOrders.toString(), sub: "pagados", icon: ShoppingBag, color: "bg-purple-50 text-purple-600" },
    { label: "Rating promedio", value: data.avgRating ? data.avgRating.toFixed(1) + " ⭐" : "—", sub: `${data.reviewCount} reseñas`, icon: Star, color: "bg-yellow-50 text-yellow-600" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Dashboard</h1>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m) => (
          <div key={m.label} className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{m.label}</span>
              <span className={`p-2 rounded-lg ${m.color}`}><m.icon size={18} /></span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{m.value}</p>
            <p className="text-xs text-gray-400 mt-1">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales chart */}
        <div className="lg:col-span-2 card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Ventas últimos 7 días</h2>
          <SalesChart data={data.salesData.map(o => ({ date: o.createdAt.toISOString().split("T")[0], total: o.total }))} />
        </div>

        {/* Recent orders */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Pedidos recientes</h2>
          <div className="space-y-3">
            {data.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0 flex-1 mr-2">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{order.user.name ?? order.user.email}</p>
                  <p className="text-gray-400 text-xs">{order.items.length} producto(s)</p>
                </div>
                <span className="font-semibold text-primary flex-shrink-0">{formatPrice(order.total)}</span>
              </div>
            ))}
            {data.recentOrders.length === 0 && <p className="text-sm text-gray-400">Sin pedidos aún</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
