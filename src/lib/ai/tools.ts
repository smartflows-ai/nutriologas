// src/lib/ai/tools.ts
// OpenRouter usa el formato de function calling de OpenAI — sin SDK de Anthropic

export interface OpenRouterTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export const CHAT_TOOLS: OpenRouterTool[] = [
  // ── VENTAS ────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_sales_summary",
      description: "Obtiene resumen de ventas: total revenue, numero de ordenes y ticket promedio en un periodo. Usa esto para preguntas como 'cuanto vendi esta semana', 'como van mis ventas este mes'.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["day", "week", "month", "year"], description: "Periodo a consultar" },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_products",
      description: "Retorna los productos mas vendidos por unidades y revenue. Usa para 'cuales son mis mejores productos', 'que producto vende mas'.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["week", "month", "year"] },
          limit: { type: "number", description: "Cuantos productos retornar (default 5)" },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_orders_by_status",
      description: "Cuenta y lista ordenes por estado (pendientes, pagadas, canceladas). Util para 'cuantos pedidos tengo pendientes'.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["PENDING", "PAID", "CANCELLED", "DELIVERED"] },
          period: { type: "string", enum: ["day", "week", "month", "year"] },
        },
        required: ["status", "period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_revenue_trend",
      description: "Serie de tiempo de revenue agrupada por dia o semana. Util para identificar tendencias y comparar periodos.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["week", "month", "year"] },
          groupBy: { type: "string", enum: ["day", "week", "month"] },
        },
        required: ["period", "groupBy"],
      },
    },
  },

  // ── CLIENTES ──────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_customer_stats",
      description: "Estadisticas de clientes: total, nuevos en el periodo, clientes recurrentes. Para 'cuantos clientes tengo', 'cuantos clientes nuevos este mes'.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["week", "month", "year"] },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_customers",
      description: "Ranking de clientes por total gastado. Para 'quien es mi mejor cliente', 'quienes compran mas'.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Cuantos clientes retornar (default 5)" },
          period: { type: "string", enum: ["month", "year", "all"] },
        },
        required: ["period"],
      },
    },
  },

  // ── PRODUCTOS Y REVIEWS ───────────────────────────────
  {
    type: "function",
    function: {
      name: "get_product_reviews",
      description: "Obtiene reviews de productos con rating y comentarios. Para 'que dicen los reviews', 'tengo reviews negativos'.",
      parameters: {
        type: "object",
        properties: {
          productSlug: { type: "string", description: "Slug del producto (opcional, si no se pasa trae todos)" },
          minRating: { type: "number", description: "Rating minimo (1-5)" },
          maxRating: { type: "number", description: "Rating maximo (1-5)" },
          limit: { type: "number", description: "Cuantos reviews retornar (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_products_performance",
      description: "Rendimiento de todos los productos: ventas, revenue, rating promedio y stock. Para 'como estan mis productos', 'cual tiene mejor rating'.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["month", "year"] },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_low_stock_products",
      description: "Lista productos con stock bajo. Para 'que productos se me estan acabando', 'que necesito reabastecer'.",
      parameters: {
        type: "object",
        properties: {
          threshold: { type: "number", description: "Stock minimo antes de alertar (default 10)" },
        },
        required: [],
      },
    },
  },

  // ── CITAS Y CONSULTAS MÉDICAS / SERVICIOS ────────────
  {
    type: "function",
    function: {
      name: "get_appointments",
      description: "Consulta las citas y consultas médicas o de servicios registradas en la agenda del negocio. Permite filtrar por periodo (today, tomorrow, week, month, all), estado (PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW, ALL) o fecha exacta (YYYY-MM-DD). Devuelve datos del paciente, servicio, horario, estado y notas clínicas.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "tomorrow", "week", "month", "all"], description: "Periodo a consultar (today, tomorrow, week, month, all)" },
          status: { type: "string", enum: ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "ALL"], description: "Estado de la cita" },
          date: { type: "string", description: "Fecha específica en formato YYYY-MM-DD" },
          limit: { type: "number", description: "Cantidad máxima de citas a retornar (default 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_appointments_summary",
      description: "Resumen estadístico de citas y consultas: total agendadas, confirmadas, completadas, pendientes, canceladas y tasa de asistencia. Para preguntas como '¿cuántas citas tuve este mes?', '¿cuál es mi tasa de asistencia?'.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["day", "week", "month", "year"] },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cancellation_patterns",
      description: "Analiza patrones de cancelacion por dia de la semana. Para 'que dia tengo mas cancelaciones', 'cuando me cancelan mas'.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["month", "year"] },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_busiest_slots",
      description: "Días y horarios con más citas o reservas agendadas. Para preguntas como 'cuándo estoy más ocupado', 'qué días tengo más citas o clientes'.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["month", "year"] },
        },
        required: ["period"],
      },
    },
  },
];

// Which helper tools a tenant gets. Sales tools need physical orders; appointment tools need booking.
const TOOL_GROUP: Record<string, "sales" | "customers" | "reviews" | "appointments"> = {
  get_sales_summary: "sales",
  get_top_products: "sales",
  get_orders_by_status: "sales",
  get_revenue_trend: "sales",
  get_products_performance: "sales",
  get_low_stock_products: "sales",
  get_top_customers: "sales", // ranks by money spent on orders
  get_customer_stats: "customers",
  get_product_reviews: "reviews",
  get_appointments: "appointments",
  get_appointments_summary: "appointments",
  get_cancellation_patterns: "appointments",
  get_busiest_slots: "appointments",
};

export function toolsFor(profile: { hasOrders: boolean; isBookingEnabled: boolean }): OpenRouterTool[] {
  return CHAT_TOOLS.filter((tool) => {
    const group = TOOL_GROUP[tool.function.name];
    if (group === "sales") return profile.hasOrders;
    if (group === "appointments") return profile.isBookingEnabled;
    return true;
  });
}

export function isToolAllowed(name: string, profile: { hasOrders: boolean; isBookingEnabled: boolean }): boolean {
  return toolsFor(profile).some((tool) => tool.function.name === name);
}
