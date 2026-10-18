// src/lib/ai/execute-tool.ts
import { prisma } from "@/lib/db";
import { getPeriodDates } from "@/lib/utils";
import { getAppToken, getConnectedProvider } from "@/lib/connected-apps";

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
        const { startDate, endDate } = input.period === "all" ? { startDate: new Date(0), endDate: new Date() } : getPeriodDates(input.period as "day" | "week" | "month" | "year");
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

      // ── CITAS Y CONSULTAS MÉDICAS / SERVICIOS ──────────
      case "get_appointments": {
        const where: any = { tenantId };

        if (input.status && input.status !== "ALL") {
          where.status = input.status;
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        if (input.date) {
          const parts = input.date.split("-").map(Number);
          if (parts.length === 3) {
            const start = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
            const end = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
            where.appointmentDate = { gte: start, lte: end };
          }
        } else if (input.period === "today") {
          where.appointmentDate = { gte: startOfToday, lte: endOfToday };
        } else if (input.period === "tomorrow") {
          const startOfTom = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
          const endOfTom = new Date(endOfToday.getTime() + 24 * 60 * 60 * 1000);
          where.appointmentDate = { gte: startOfTom, lte: endOfTom };
        } else if (input.period === "week") {
          const { startDate, endDate } = getPeriodDates("week");
          where.appointmentDate = { gte: startDate, lte: endDate };
        } else if (input.period === "month") {
          const { startDate, endDate } = getPeriodDates("month");
          where.appointmentDate = { gte: startDate, lte: endDate };
        }

        const appointments = await prisma.appointment.findMany({
          where,
          include: {
            product: { select: { name: true, durationMinutes: true, price: true } },
            user: { select: { name: true, email: true } },
          },
          orderBy: { appointmentDate: "asc" },
          take: input.limit ?? 20,
        });

        return JSON.stringify({
          count: appointments.length,
          period: input.period ?? (input.date ? `date:${input.date}` : "all"),
          appointments: appointments.map((a) => {
            const dateStr = a.appointmentDate.toISOString().split("T")[0];
            const timeStr = a.appointmentDate.toISOString().split("T")[1]?.slice(0, 5) ?? "";
            return {
              id: a.id.slice(0, 8),
              patientName: a.user?.name || "Sin nombre",
              patientEmail: a.user?.email || null,
              service: a.product?.name ?? "Consulta General",
              durationMinutes: a.durationMinutes ?? a.product?.durationMinutes ?? 30,
              price: a.product?.price ?? null,
              date: dateStr,
              time: timeStr,
              status: a.status,
              notes: a.notes,
              internalNotes: a.internalNotes,
            };
          }),
        });
      }

      case "get_appointments_summary": {
        const { startDate, endDate } = getPeriodDates(input.period);

        // Primero consultamos las citas nativas del CRM
        const nativeAppointments = await prisma.appointment.findMany({
          where: { tenantId, appointmentDate: { gte: startDate, lte: endDate } },
          include: { product: { select: { name: true, price: true } } },
        });

        if (nativeAppointments.length > 0) {
          const total = nativeAppointments.length;
          const confirmed = nativeAppointments.filter(a => a.status === "CONFIRMED").length;
          const completed = nativeAppointments.filter(a => a.status === "COMPLETED").length;
          const pending = nativeAppointments.filter(a => a.status === "PENDING").length;
          const cancelled = nativeAppointments.filter(a => a.status === "CANCELLED").length;
          const noShow = nativeAppointments.filter(a => a.status === "NO_SHOW").length;
          const attended = completed + confirmed;
          const rate = total > 0 ? Math.round((attended / (total - cancelled || 1)) * 100) : 0;

          return JSON.stringify({
            source: "crm_native",
            total,
            confirmed,
            completed,
            pending,
            cancelled,
            noShow,
            attendanceRate: rate,
            period: input.period,
          });
        }

        // Si no hay nativas, revisar si hay calendario externo conectado
        const calProvider = await getConnectedProvider(tenantId, ["GOOGLE", "MICROSOFT"]);
        if (!calProvider) {
          return JSON.stringify({
            total: 0,
            confirmed: 0,
            completed: 0,
            pending: 0,
            cancelled: 0,
            attendanceRate: 0,
            message: "No se encontraron citas registradas en la agenda para este periodo.",
            period: input.period,
          });
        }
        const calToken = await getAppToken(tenantId, calProvider);
        if (!calToken) {
          return JSON.stringify({ error: "Token de calendario expirado. Reconectar desde Apps." });
        }

        const timeMin = startDate.toISOString();
        const timeMax = endDate.toISOString();

        let calEvents: any[] = [];
        if (calProvider === "GOOGLE") {
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
            new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "200" }).toString(),
            { headers: { Authorization: `Bearer ${calToken}` } }
          );
          if (res.ok) { const d = await res.json(); calEvents = d.items ?? []; }
        } else {
          const res = await fetch(
            `https://graph.microsoft.com/v1.0/me/calendarView?` +
            new URLSearchParams({ startDateTime: timeMin, endDateTime: timeMax, $top: "200" }).toString(),
            { headers: { Authorization: `Bearer ${calToken}` } }
          );
          if (res.ok) { const d = await res.json(); calEvents = d.value ?? []; }
        }

        const now = new Date();
        const total = calEvents.length;
        const cancelled = calEvents.filter((e: any) => e.status === "cancelled" || e.isCancelled).length;
        const past = calEvents.filter((e: any) => {
          const s = e.start?.dateTime || e.start?.date || "";
          return new Date(s) < now;
        }).length;
        const attended = past - cancelled;
        const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

        return JSON.stringify({ total, attended, cancelled, pending: total - past, attendanceRate: rate, period: input.period, provider: calProvider });
      }

      case "get_cancellation_patterns": {
        return JSON.stringify({ note: "Funcionalidad próxima. Conecta tu calendario desde Apps para habilitarla." });
      }

      case "get_busiest_slots": {
        return JSON.stringify({ note: "Funcionalidad próxima. Conecta tu calendario desde Apps para habilitarla." });
      }

      default:
        return JSON.stringify({ error: `Tool desconocida: ${toolName}` });
    }
  } catch (error) {
    console.error(`Error en tool ${toolName}:`, error);
    return JSON.stringify({ error: `Error ejecutando ${toolName}. Intenta de nuevo.` });
  }
}
