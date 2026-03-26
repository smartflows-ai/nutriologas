// src/app/api/orders/[id]/route.ts
// PATCH: Admin updates order status (e.g. PAID → SHIPPED → DELIVERED)
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const VALID_STATUSES = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId as string;
  const { id } = await params;
  const { status } = await req.json();

  if (!VALID_STATUSES.includes(status)) {
    return Response.json({ error: "Status inválido" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id, tenantId },
    include: { items: true },
  });

  if (!order) {
    return Response.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  // If cancelling a PENDING order, restore stock
  if (status === "CANCELLED" && order.status === "PENDING") {
    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
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
    return Response.json({ message: "Pedido cancelado, stock restaurado" });
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status },
  });

  return Response.json({ message: "Status actualizado" });
}
