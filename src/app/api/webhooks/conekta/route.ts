// src/app/api/webhooks/conekta/route.ts
// Receives Conekta webhook events and keeps Order status in sync.
// Signature verification: HMAC-SHA256 using CONEKTA_WEBHOOK_SECRET.
// Always return 200 on success so Conekta doesn't retry.
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

async function verifyConektaSignature(req: Request): Promise<{ body: any; error?: string }> {
  const secret = process.env.CONEKTA_WEBHOOK_SECRET;
  if (!secret) {
    // If no secret is configured, block all incoming requests in production
    if (process.env.NODE_ENV === "production") {
      return { body: null, error: "Webhook secret not configured" };
    }
    // In development, skip signature check (secret may not be set locally)
    try {
      const body = await req.json();
      return { body };
    } catch {
      return { body: null, error: "Invalid JSON" };
    }
  }

  const rawBody = await req.text();
  const signature = req.headers.get("Conekta-Signature") ?? req.headers.get("conekta-signature") ?? "";

  const expectedHmac = createHmac("sha256", secret).update(rawBody).digest("hex");

  let signaturesMatch = false;
  try {
    // Conekta may send "t=<ts>,v1=<hash>" or just the raw hex digest
    const sigHash = signature.includes("v1=")
      ? signature.split("v1=").pop()!.trim()
      : signature.trim();
    signaturesMatch = timingSafeEqual(
      Buffer.from(expectedHmac, "hex"),
      Buffer.from(sigHash, "hex"),
    );
  } catch {
    signaturesMatch = false;
  }

  if (!signaturesMatch) {
    return { body: null, error: "Invalid signature" };
  }

  try {
    const body = JSON.parse(rawBody);
    return { body };
  } catch {
    return { body: null, error: "Invalid JSON" };
  }
}

export async function POST(req: Request) {
  const { body, error } = await verifyConektaSignature(req);
  if (error || !body) {
    return new Response(error ?? "Bad request", { status: error === "Invalid signature" ? 401 : 400 });
  }

  const { type: eventType, data } = body;

  if (!eventType || !data?.object) {
    return new Response("Invalid payload", { status: 400 });
  }

  // charge events: data.object.order_id
  // order events:  data.object.id
  const conektaOrderId: string = data.object.order_id ?? data.object.id;
  if (!conektaOrderId) {
    return new Response("Missing order ID", { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { paymentReference: conektaOrderId },
  });

  // Respond 200 even when not found — Conekta may fire events for old / deleted orders
  if (!order) {
    return new Response("OK", { status: 200 });
  }

  switch (eventType) {
    case "charge.created":
      await prisma.order.update({
        where: { id: order.id },
        data: { conektaChargeId: data.object.id },
      });
      break;

    case "order.pending_payment":
      // User submitted form; waiting for cash payment (OXXO) or card processing
      break;

    case "order.paid":
    case "charge.paid":
      if (order.status !== "PAID") {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "PAID" },
        });
      }
      break;

    case "order.canceled":
    case "order.expired":
      if (order.status === "PENDING") {
        // Restore stock and cancel order atomically
        const orderItems = await prisma.orderItem.findMany({
          where: { orderId: order.id },
        });
        await prisma.$transaction(async (tx) => {
          for (const item of orderItems) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }
          await tx.order.update({
            where: { id: order.id },
            data: { status: "CANCELLED" },
          });
        });
      }
      break;

    default:
      // Unhandled event — return 200
      break;
  }

  return new Response("OK", { status: 200 });
}
