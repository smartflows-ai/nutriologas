// scripts/clean-user-orders.ts
// Elimina todas las órdenes de un usuario específico por email
// Uso: npx tsx scripts/clean-user-orders.ts

import "dotenv/config";
import { prisma } from "../src/lib/db";

async function cleanUserOrders(userEmail: string) {
  console.log("🔍 Buscando usuario:", userEmail);

  const user = await prisma.user.findFirst({
    where: { email: userEmail },
    include: {
      orders: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!user) {
    console.error("❌ Usuario no encontrado:", userEmail);
    return;
  }

  console.log("✅ Usuario encontrado:", user.id);
  console.log("📦 Órdenes asociadas:", user.orders.length);

  if (user.orders.length === 0) {
    console.log("ℹ️ No hay órdenes para eliminar");
    return;
  }

  // Mostrar resumen de órdenes a eliminar
  console.log("\n📋 Órdenes a eliminar:");
  user.orders.forEach((order, i) => {
    console.log(
      `  ${i + 1}. ${order.id} - ${order.status} - $${order.total} - ${order.items.length} items`,
    );
  });

  console.log("\n⚠️ Esto eliminará permanentemente las órdenes y sus items.");
  console.log("   ¿Continuar? (Ctrl+C para cancelar)\n");

  // Esperar 2 segundos para dar oportunidad de cancelar
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Eliminar OrderItems primero (foreign key constraint)
  const orderIds = user.orders.map((o) => o.id);

  const deletedItems = await prisma.orderItem.deleteMany({
    where: {
      orderId: { in: orderIds },
    },
  });

  console.log("🗑️ OrderItems eliminados:", deletedItems.count);

  // Eliminar Orders
  const deletedOrders = await prisma.order.deleteMany({
    where: {
      id: { in: orderIds },
      userId: user.id,
    },
  });

  console.log("🗑️ Órdenes eliminadas:", deletedOrders.count);

  console.log("\n✅ Limpieza completada para:", userEmail);
  console.log("   Total items eliminados:", deletedItems.count);
  console.log("   Total órdenes eliminadas:", deletedOrders.count);
}

// Ejecutar con el email del usuario
const userEmail = process.argv[2] || "smartflows.co@gmail.com";

cleanUserOrders(userEmail).catch(console.error);
