// src/app/api/webhooks/conekta/route.ts
// Receives Conekta webhook events and keeps Order status in sync.
// NO authentication middleware — Conekta sends no auth headers.
// Always return 200 so Conekta doesn't retry.
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  console.log("[Conekta webhook] === Evento recibido ===");
  console.log("[Conekta webhook] Timestamp:", new Date().toISOString());

  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    console.error("[Conekta webhook] Error parsing JSON:", err);
    console.error("[Conekta webhook] Raw body:", await req.text());
    return new Response("Invalid JSON", { status: 400 });
  }

  console.log("[Conekta webhook] Evento:", body?.type);
  console.log("[Conekta webhook] Payload:", JSON.stringify(body, null, 2));

  const { type: eventType, data } = body;

  if (!eventType || !data?.object) {
    console.error(
      "[Conekta webhook] Invalid payload - missing eventType or data.object",
    );
    return new Response("Invalid payload", { status: 400 });
  }

  // charge events: data.object.order_id
  // order events:  data.object.id
  const conektaOrderId: string = data.object.order_id ?? data.object.id;
  if (!conektaOrderId) {
    console.error("[Conekta webhook] Missing order ID in payload");
    return new Response("Missing order ID", { status: 400 });
  }

  console.log(
    "[Conekta webhook] Buscando orden con paymentReference:",
    conektaOrderId,
  );

  const order = await prisma.order.findFirst({
    where: { paymentReference: conektaOrderId },
  });

  // Respond 200 even when not found — Conekta may fire events for old / deleted orders
  if (!order) {
    console.warn(
      "[Conekta webhook] Order not found for conekta id:",
      conektaOrderId,
    );
    console.warn(
      "[Conekta webhook] Esto puede pasar si la orden fue eliminada o el paymentReference no se guardó",
    );
    return new Response("OK", { status: 200 });
  }

  console.log("[Conekta webhook] Order encontrada:", order.id);
  console.log("[Conekta webhook] Status actual:", order.status);
  console.log("[Conekta webhook] Payment method:", order.paymentMethod);

  switch (eventType) {
    case "charge.created":
      console.log("[Conekta webhook] Evento: charge.created");
      console.log("[Conekta webhook] Charge ID:", data.object.id);
      await prisma.order.update({
        where: { id: order.id },
        data: { conektaChargeId: data.object.id },
      });
      console.log("[Conekta webhook] ✅ Charge ID guardado en DB");
      break;

    case "order.pending_payment":
      console.log("[Conekta webhook] Evento: order.pending_payment");
      // User submitted form; waiting for cash payment (OXXO) or card processing
      if (order.status === "PENDING") {
        // Already PENDING — no status change needed; log for observability
        console.log("[Conekta webhook] Order ya está en PENDING - sin cambios");
      }
      break;

    case "order.paid":
    case "charge.paid":
      console.log("[Conekta webhook] Evento:", eventType);
      console.log("[Conekta webhook] Status actual:", order.status);
      if (order.status !== "PAID") {
        console.log("[Conekta webhook] Actualizando status a PAID...");
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "PAID" },
        });
        console.log("[Conekta webhook] ✅ Order marcada como PAID");
      } else {
        console.log("[Conekta webhook] Order ya está PAID - sin cambios");
      }
      break;

    case "order.canceled":
    case "order.expired":
      console.log("[Conekta webhook] Evento:", eventType);
      if (order.status === "PENDING") {
        console.log(
          "[Conekta webhook] Cancelando orden y restaurando stock...",
        );
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
        console.log("[Conekta webhook] ✅ Orden cancelada, stock restaurado");
      } else {
        console.log(
          "[Conekta webhook] Order no está en PENDING - sin acción necesaria",
        );
      }
      break;

    default:
      // Unhandled event — log and return 200
      console.log("[Conekta webhook] Evento no manejado:", eventType);
      console.log(
        "[Conekta webhook] Payload completo:",
        JSON.stringify(body, null, 2),
      );
      break;
  }

  console.log("[Conekta webhook] === Fin del procesamiento ===");
  return new Response("OK", { status: 200 });
}
