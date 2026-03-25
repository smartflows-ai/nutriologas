// src/app/api/checkout/verify-payment/route.ts
// Fallback endpoint to manually verify payment status with Conekta API
// Call this if the webhook doesn't arrive or you need to force-sync the status
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getConektaOrder } from "@/lib/conekta";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = session.user.id!;
  const { orderId } = await req.json();

  if (!orderId) {
    return Response.json({ error: "orderId requerido" }, { status: 400 });
  }

  console.log("[verify-payment] Verifying payment for order:", orderId);

  // First try to find by ID
  let order = await prisma.order.findFirst({
    where: { id: orderId, userId },
  });

  // If not found by ID, try to find by paymentReference (Conekta order ID)
  if (!order) {
    order = await prisma.order.findFirst({
      where: {
        paymentReference: orderId,
        userId,
      },
    });
    console.log(
      "[verify-payment] Order not found by ID, trying by paymentReference",
    );
  }

  if (!order) {
    console.error("[verify-payment] Order not found:", orderId);
    return Response.json({ error: "Orden no encontrada" }, { status: 404 });
  }

  if (!order.paymentReference) {
    console.error("[verify-payment] Order has no paymentReference");
    return Response.json(
      { error: "Orden no tiene referencia de pago" },
      { status: 400 },
    );
  }

  // Query Conekta API to get the current status
  try {
    console.log(
      "[verify-payment] Consultingando Conekta API para:",
      order.paymentReference,
    );
    const conektaOrder = await getConektaOrder(order.paymentReference);

    console.log("[verify-payment] Conekta order status:", conektaOrder.status);
    console.log(
      "[verify-payment] Payment status:",
      conektaOrder.payment_status,
    );

    const isPaid =
      conektaOrder.status === "paid" || conektaOrder.payment_status === "paid";

    // Update DB if payment is confirmed
    if (isPaid && order.status !== "PAID") {
      console.log("[verify-payment] Updating order status to PAID");
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "PAID" },
      });

      // Also update charge ID if available
      const charge = conektaOrder.charges?.data?.[0];
      if (charge && !order.conektaChargeId) {
        await prisma.order.update({
          where: { id: order.id },
          data: { conektaChargeId: charge.id },
        });
      }

      console.log("[verify-payment] ✅ Order marked as PAID");
      return Response.json({
        message: "Pago verificado exitosamente",
        orderId: order.id,
        status: "PAID",
        conektaStatus: conektaOrder.status,
      });
    }

    // Already paid or still pending
    if (order.status === "PAID") {
      console.log("[verify-payment] Order already PAID");
      return Response.json({
        message: "Orden ya está pagada",
        orderId: order.id,
        status: "PAID",
        conektaStatus: conektaOrder.status,
      });
    }

    console.log("[verify-payment] Order still pending");
    return Response.json({
      message: "Pago aún pendiente",
      orderId: order.id,
      status: order.status,
      conektaStatus: conektaOrder.status,
    });
  } catch (err: any) {
    console.error("[verify-payment] Error consultingando Conekta:", err);
    return Response.json(
      {
        error: "Error al verificar pago con Conekta",
        details: err.message,
      },
      { status: 500 },
    );
  }
}
