// src/app/api/webhooks/conekta/route.ts
// Receives Conekta webhook events and keeps Order status in sync.
// NO authentication middleware — Conekta sends no auth headers.
// Always return 200 so Conekta doesn't retry.
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return new Response("Invalid JSON", { status: 400 });
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
