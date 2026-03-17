// src/lib/ai/execute-tool.ts
import { prisma } from "@/lib/db";
import { getPeriodDates } from "@/lib/utils";

type Period = "day" | "week" | "month" | "year" | "all";

export async function executeTool(
  toolName: string,
  input: Record<string, any>,
  tenantId: string // siempre viene de la sesion — nunca del usuario
): Promise<string> {
  try {
    switch (toolName) {

      // ── VENTAS ──────────────────────────────────────────
      case "get_sales_summary": {
        const { startDate, endDate } = getPeriodDates(input.period);
        const orders = await prisma.order.findMany({
          where: { tenantId, status: "PAID", createdAt: { gte: startDate, lte: endDate } },
        });
        const total = orders.reduce((s, o) => s + o.total, 0);
        // Periodo anterior para comparacion
        const prevStart = new Date(startDate);
        const prevEnd = new Date(startDate);
        const diff = endDate.getTime() - startDate.getTime();
        prevStart.setTime(startDate.getTime() - diff);
        const prevOrders = await prisma.order.findMany({
          where: { tenantId, status: "PAID", createdAt: { gte: prevStart, lte: prevEnd } },
        });
        const prevTotal = prevOrders.reduce((s, o) => s + o.total, 0);
        const change = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
        return JSON.stringify({
          totalRevenue: total,
          orderCount: orders.length,
          averageTicket: orders.length > 0 ? total / orders.length : 0,
          vsLastPeriod: { amount: prevTotal, changePercent: Math.round(change) },
          period: input.period,
        });
      }

      case "get_top_products": {
        const { startDate, endDate } = input.period !== "all" ? getPeriodDates(input.period) : { startDate: new Date(0), endDate: new Date() };
        const limit = input.limit ?? 5;
        const items = await prisma.orderItem.groupBy({
          by: ["productId"],
          where: { order: { tenantId, status: "PAID", createdAt: { gte: startDate, lte: endDate } } },
          _sum: { quantity: true, unitPrice: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: limit,
        });
        const enriched = await Promise.all(
          items.map(async (item) => {
            const p = await prisma.product.findUnique({ where: { id: item.productId }, select: { name: true, price: true } });
            return { name: p?.name ?? "Desconocido", unitsSold: item._sum.quantity ?? 0, revenue: item._sum.unitPrice ?? 0 };
          })
        );
        return JSON.stringify(enriched);
      }

      case "get_orders_by_status": {
        const { startDate, endDate } = getPeriodDates(input.period);
        const orders = await prisma.order.findMany({
          where: { tenantId, status: input.status, createdAt: { gte: startDate, lte: endDate } },
          include: { user: { select: { name: true, email: true } } },
          take: 20,
          orderBy: { createdAt: "desc" },
        });
        return JSON.stringify({ count: orders.length, orders: orders.map(o => ({ id: o.id.slice(0, 8), total: o.total, customer: o.user.name ?? o.user.email, date: o.createdAt })) });
      }

      case "get_revenue_trend": {
        const { startDate, endDate } = getPeriodDates(input.period);
        const orders = await prisma.order.findMany({
          where: { tenantId, status: "PAID", createdAt: { gte: startDate, lte: endDate } },
          select: { total: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        });
        // Agrupar por dia
        const grouped: Record<string, number> = {};
        for (const o of orders) {
          const key = o.createdAt.toISOString().split("T")[0];
          grouped[key] = (grouped[key] ?? 0) + o.total;
        }
        return JSON.stringify(Object.entries(grouped).map(([date, revenue]) => ({ date, revenue })));
      }

      // ── CLIENTES ────────────────────────────────────────
      case "get_customer_stats": {
        const { startDate, endDate } = getPeriodDates(input.period);
        const totalCustomers = await prisma.user.count({ where: { tenantId, role: "CUSTOMER" } });
        const newCustomers = await prisma.user.count({ where: { tenantId, role: "CUSTOMER", createdAt: { gte: startDate, lte: endDate } } });
        const returningCustomers = await prisma.order.groupBy({
          by: ["userId"],
          where: { tenantId, status: "PAID", createdAt: { gte: startDate, lte: endDate } },
          having: { userId: { _count: { gt: 1 } } },
        });
        return JSON.stringify({ totalCustomers, newInPeriod: newCustomers, returningInPeriod: returningCustomers.length, period: input.period });
      }

      case "get_top_customers": {
        const { startDate, endDate } = input.period === "all" ? { startDate: new Date(0), endDate: new Date() } : getPeriodDates(input.period as Period);
        const limit = input.limit ?? 5;
        const grouped = await prisma.order.groupBy({
          by: ["userId"],
          where: { tenantId, status: "PAID", createdAt: { gte: startDate, lte: endDate } },
          _sum: { total: true },
          _count: { id: true },
          orderBy: { _sum: { total: "desc" } },
          take: limit,
        });
        const enriched = await Promise.all(
          grouped.map(async (g) => {
            const u = await prisma.user.findUnique({ where: { id: g.userId }, select: { name: true, email: true } });
            return { customer: u?.name ?? u?.email ?? "Desconocido", totalSpent: g._sum.total ?? 0, orderCount: g._count.id };
          })
        );
        return JSON.stringify(enriched);
      }

      // ── PRODUCTOS Y REVIEWS ─────────────────────────────
      case "get_product_reviews": {
        const limit = input.limit ?? 10;
        const where: any = { tenantId };
        if (input.productSlug) {
          const p = await prisma.product.findUnique({ where: { tenantId_slug: { tenantId, slug: input.productSlug } } });
          if (p) where.productId = p.id;
        }
        if (input.minRating) where.rating = { ...where.rating, gte: input.minRating };
        if (input.maxRating) where.rating = { ...where.rating, lte: input.maxRating };
        const reviews = await prisma.review.findMany({
          where,
          include: { user: { select: { name: true } }, product: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: limit,
        });
        return JSON.stringify(reviews.map(r => ({ product: r.product.name, customer: r.user.name ?? "Anónimo", rating: r.rating, comment: r.comment, date: r.createdAt })));
      }

      case "get_products_performance": {
        const { startDate, endDate } = getPeriodDates(input.period);
        const products = await prisma.product.findMany({
          where: { tenantId, deletedAt: null },
          include: {
            orderItems: { where: { order: { status: "PAID", createdAt: { gte: startDate, lte: endDate } } } },
            reviews: { where: { tenantId } },
          },
        });
        return JSON.stringify(products.map(p => ({
          name: p.name,
          stock: p.stock,
          isActive: p.isActive,
          unitsSold: p.orderItems.reduce((s, i) => s + i.quantity, 0),
          revenue: p.orderItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
          avgRating: p.reviews.length > 0 ? (p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length).toFixed(1) : null,
          reviewCount: p.reviews.length,
        })));
      }

      case "get_low_stock_products": {
        const threshold = input.threshold ?? 10;
        const products = await prisma.product.findMany({
          where: { tenantId, stock: { lte: threshold }, isActive: true, deletedAt: null },
          orderBy: { stock: "asc" },
        });
        return JSON.stringify(products.map(p => ({ name: p.name, stock: p.stock, price: p.price })));
      }

      // ── CALENDARIO ──────────────────────────────────────
      case "get_appointments_summary": {
        // Lee el token de Google Calendar del admin del tenant
        const admin = await prisma.user.findFirst({ where: { tenantId, role: "ADMIN" }, select: { googleCalendarToken: true } });
        if (!admin?.googleCalendarToken) {
          return JSON.stringify({ error: "Google Calendar no conectado. El admin debe conectar su cuenta en Configuracion." });
        }
        // TODO: llamar a Google Calendar API con el token
        // Por ahora retorna datos de ejemplo
        return JSON.stringify({
          note: "Integrar con Google Calendar API usando el token del admin",
          total: 0, attended: 0, cancelled: 0, attendanceRate: 0,
          period: input.period,
        });
      }

      case "get_cancellation_patterns": {
        return JSON.stringify({ note: "Requiere Google Calendar conectado. Implementar con googleapis." });
      }

      case "get_busiest_slots": {
        return JSON.stringify({ note: "Requiere Google Calendar conectado. Implementar con googleapis." });
      }

      default:
        return JSON.stringify({ error: `Tool desconocida: ${toolName}` });
    }
  } catch (error) {
    console.error(`Error en tool ${toolName}:`, error);
    return JSON.stringify({ error: `Error ejecutando ${toolName}. Intenta de nuevo.` });
  }
}
