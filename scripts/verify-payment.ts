// scripts/verify-payment.ts
// Verifica manualmente el status de un pago con la API de Conekta
// y actualiza la DB si el pago está confirmado
// Uso: npx tsx scripts/verify-payment.ts <orderId>

import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getConektaOrder } from "../src/lib/conekta";

async function verifyPayment(orderId: string) {
  console.log("🔍 Verificando pago para orden:", orderId);

  // Buscar la orden en DB
  const order = await prisma.order.findFirst({
    where: { id: orderId },
  });

  if (!order) {
    console.error("❌ Orden no encontrada:", orderId);
    return;
  }

  console.log("✅ Orden encontrada:", order.id);
  console.log("   Status actual:", order.status);
  console.log("   Payment Reference:", order.paymentReference);

  if (!order.paymentReference) {
    console.error("❌ Orden no tiene paymentReference (Conekta order ID)");
    return;
  }

  // Consultar la API de Conekta
  console.log("\n📡 Consultando Conekta API...");
  try {
    const conektaOrder = await getConektaOrder(order.paymentReference);

    console.log("   Conekta order ID:", conektaOrder.id);
    console.log("   Conekta status:", conektaOrder.status);
    console.log("   Payment status:", conektaOrder.payment_status);

    const isPaid =
      conektaOrder.status === "paid" ||
      conektaOrder.payment_status === "paid";

    if (isPaid) {
      console.log("\n✅ Pago confirmado por Conekta");

      if (order.status === "PAID") {
        console.log("   La orden ya está marcada como PAID en DB");
        return;
      }

      // Actualizar status a PAID
      console.log("   Actualizando status a PAID...");
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "PAID" },
      });

      // Actualizar charge ID si está disponible
      const charge = conektaOrder.charges?.data?.[0];
      if (charge && !order.conektaChargeId) {
        console.log("   Guardando charge ID:", charge.id);
        await prisma.order.update({
          where: { id: order.id },
          data: { conektaChargeId: charge.id },
        });
      }

      console.log("\n✅ Orden actualizada exitosamente");
      console.log("   Nueva status: PAID");
    } else {
      console.log("\n⏳ Pago aún pendiente en Conekta");
      console.log("   Status en Conekta:", conektaOrder.status);
    }
  } catch (err: any) {
    console.error("❌ Error consultando Conekta:", err.message);
    console.error("   Response:", err?.response?.data);
    return;
  }
}

// Ejecutar con el orderId proporcionado como argumento
const orderId = process.argv[2];

if (!orderId) {
  console.error("❌ Uso: npx tsx scripts/verify-payment.ts <orderId>");
  console.error("   Ejemplo: npx tsx scripts/verify-payment.ts 1f38f55b-fefe-4563-979c-1a39e871bdcb");
  process.exit(1);
}

verifyPayment(orderId).catch(console.error);
