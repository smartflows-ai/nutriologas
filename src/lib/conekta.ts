// src/lib/conekta.ts
// Uses native fetch instead of the conekta npm SDK to avoid
// __dirname cert path issues when bundled by Next.js.

const BASE_URL = "https://api.conekta.io";

function getHeaders() {
  return {
    Accept: "application/vnd.conekta-v2.2.0+json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.CONEKTA_PRIVATE_KEY}`,
  };
}

async function conektaFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers ?? {}) },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(`Conekta API ${res.status}: ${JSON.stringify(body)}`);
    (err as any).response = { data: body };
    throw err;
  }

  return body;
}

// ─── Customers ────────────────────────────────────────────

export async function createConektaCustomer(data: {
  name: string;
  email: string;
  phone?: string;
}) {
  return conektaFetch("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      ...(data.phone ? { phone: data.phone } : {}),
    }),
  });
}

// ─── Orders ──────────────────────────────────────────────

export interface ConektaLineItem {
  name: string;
  unit_price: number; // centavos (MXN pesos × 100)
  quantity: number;
}

export async function createConektaOrder(params: {
  customerId: string;
  referenceId: string;
  lineItems: ConektaLineItem[];
  allowedPaymentMethods: string[];
  baseUrl?: string;
}) {
  const base = params.baseUrl ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return conektaFetch("/orders", {
    method: "POST",
    body: JSON.stringify({
      currency: "MXN",
      customer_info: { customer_id: params.customerId },
      line_items: params.lineItems,
      metadata: { referenceId: params.referenceId },
      checkout: {
        type: "HostedPayment",
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        allowed_payment_methods: params.allowedPaymentMethods,
        success_url: `${base}/checkout`,
        failure_url: `${base}/checkout`,
      },
    }),
  });
}

export async function getConektaOrder(orderId: string) {
  return conektaFetch(`/orders/${orderId}`);
}

export async function cancelConektaOrder(orderId: string) {
  return conektaFetch(`/orders/${orderId}/cancel`, { method: "POST" });
}
