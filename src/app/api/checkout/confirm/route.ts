// src/app/api/checkout/confirm/route.ts
// Called by the frontend's onFinalizePayment callback after the Conekta iframe completes.
// Updates payment method info. The webhook (order.paid) is the authoritative source for PAID status.
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = session.user.id!;
  const { orderId, conektaOrder } = await req.json();

  console.log("[checkout/confirm] orderId:", orderId);
  console.log("[checkout/confirm] conektaOrder:", JSON.stringify(conektaOrder, null, 2));

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
  });

  if (!order) {
    return Response.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  // Update payment type from the Conekta order object returned by the callback
  const charge = conektaOrder?.charges?.data?.[0];
  const paymentType = charge?.payment_method?.type;
  if (paymentType) {
    const mapped =
      paymentType === "cash"
        ? "OXXO_CONEKTA"
        : ("CARD_CONEKTA" as "CARD_CONEKTA" | "OXXO_CONEKTA");
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentMethod: mapped },
    });
  }

  // Only mark as PAID if Conekta explicitly confirms payment in the response.
  // Otherwise, the webhook (order.paid) is the authoritative source.
  const chargeStatus = charge?.status;
  const orderPaymentStatus = conektaOrder?.payment_status;
  const isPaid = chargeStatus === "paid" || orderPaymentStatus === "paid";

  console.log("[checkout/confirm] chargeStatus:", chargeStatus, "orderPaymentStatus:", orderPaymentStatus);

  if (isPaid && order.status !== "PAID") {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PAID" },
    });
    console.log("[checkout/confirm] Order marked as PAID (Conekta confirmed)");
  }

  return Response.json({ message: "Pago recibido", orderId: order.id });
}
