// src/app/admin/dashboard/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { ShoppingBag, Users, Star, TrendingUp } from "lucide-react";
import SalesChart from "@/components/crm/SalesChart";
import ProductsChart from "@/components/crm/ProductsChart";
import RatingsChart from "@/components/crm/RatingsChart";
import AppointmentsChart from "@/components/crm/AppointmentsChart";
import DashboardFilters from "@/components/crm/DashboardFilters";

async function getDashboardData(tenantId: string, rangeStr: string) {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  let numDays = 7;
  if (rangeStr === "7d") {
    numDays = 7;
    startDate.setDate(now.getDate() - 6);
  } else if (rangeStr === "30d") {
    numDays = 30;
    startDate.setDate(now.getDate() - 29);
  } else if (rangeStr === "thisMonth") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    numDays = now.getDate();
  } else if (rangeStr === "allTime") {
    startDate = new Date(2020, 0, 1);
    numDays = Math.max(1, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  }
  startDate.setHours(0, 0, 0, 0);

  const chartDaysCount = Math.min(numDays, 90); 
  const days: string[] = [];
  for (let i = 0; i < chartDaysCount; i++) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - (chartDaysCount - 1 - i));
    days.push(d.toISOString().split("T")[0]);
  }

  const filter = { gte: startDate, lte: endDate };

  const allOrders = await prisma.order.findMany({
    where: { tenantId, status: "PAID", createdAt: filter },
    include: { items: { include: { product: true } }, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" }
  });

  const totalCustomers = await prisma.user.count({ where: { tenantId, role: "CUSTOMER" } });
  const newCustomers = await prisma.user.count({ where: { tenantId, role: "CUSTOMER", createdAt: filter } });

  const reviews = await prisma.review.findMany({ where: { tenantId, createdAt: filter } });

  const recentOrders = [...allOrders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5);
  const revenue = allOrders.reduce((s, o) => s + o.total, 0);

  // Ratings Dist
  const ratingsDist = [
    { stars: "1 Estrella", count: 0 },
    { stars: "2 Estrellas", count: 0 },
    { stars: "3 Estrellas", count: 0 },
    { stars: "4 Estrellas", count: 0 },
    { stars: "5 Estrellas", count: 0 },
  ];
  let totalRatingSum = 0;
  reviews.forEach(r => {
    if (r.rating >= 1 && r.rating <= 5) {
      ratingsDist[r.rating - 1].count += 1;
      totalRatingSum += r.rating;
    }
  });
  const avgRating = reviews.length > 0 ? totalRatingSum / reviews.length : 0;

  // Products
  const productQuantities: Record<string, number> = {};
  allOrders.forEach(order => {
    order.items.forEach(item => {
      const name = item.product.name;
      productQuantities[name] = (productQuantities[name] || 0) + item.quantity;
    });
  });
  const topProducts = Object.entries(productQuantities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, quantity]) => ({ name: name.length > 20 ? name.substring(0, 20) + '...' : name, quantity }));

  // Sales Chart
  const salesChartData = days.map(dateStr => {
    const total = allOrders
      .filter(o => o.createdAt.toISOString().split("T")[0] === dateStr)
      .reduce((sum, o) => sum + o.total, 0);
    return { date: dateStr, total };
  });

  return { revenue, orderCount: allOrders.length, totalCustomers, newCustomers, avgRating, reviewCount: reviews.length, recentOrders, salesChartData, topProducts, ratingsDist, days };
}

export default async function DashboardPage({ searchParams }: { searchParams: { range?: string } }) {
  const session = await getServerSession(authOptions);
  const tenantId = (session!.user as any).tenantId as string;
  const range = searchParams.range || "7d";
  const data = await getDashboardData(tenantId, range);

  const metrics = [
    { label: "Ingresos", value: formatPrice(data.revenue), sub: `${data.orderCount} pedidos`, icon: TrendingUp, color: "bg-green-50 text-green-600" },
    { label: "Clientes totales", value: data.totalCustomers.toString(), sub: `+${data.newCustomers} en período`, icon: Users, color: "bg-blue-50 text-blue-600" },
    { label: "Pedidos pagados", value: data.orderCount.toString(), sub: "exitosos", icon: ShoppingBag, color: "bg-purple-50 text-purple-600" },
    { label: "Promedio reseñas", value: data.avgRating ? data.avgRating.toFixed(1) + " ⭐" : "—", sub: `${data.reviewCount} reseñas`, icon: Star, color: "bg-yellow-50 text-yellow-600" },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Analítico</h1>
        <DashboardFilters />
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Ventas en el período</h2>
          <SalesChart data={data.salesChartData} />
        </div>
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Volumen de Citas</h2>
          <AppointmentsChart days={data.days} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Top 5 Productos</h2>
          <ProductsChart data={data.topProducts} />
        </div>
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Distribución de Reseñas</h2>
          <RatingsChart data={data.ratingsDist} />
        </div>
        <div className="card">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Pedidos recientes</h2>
          <div className="space-y-4 max-h-[220px] overflow-y-auto pr-2">
            {data.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between text-sm border-b border-gray-50 dark:border-gray-800 pb-2 last:border-0 last:pb-0">
                <div className="min-w-0 flex-1 mr-2">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{order.user.name ?? order.user.email}</p>
                  <p className="text-gray-400 text-xs">{order.items.length} producto(s)</p>
                </div>
                <span className="font-semibold text-primary flex-shrink-0">{formatPrice(order.total)}</span>
              </div>
            ))}
            {data.recentOrders.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Sin pedidos aún</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
