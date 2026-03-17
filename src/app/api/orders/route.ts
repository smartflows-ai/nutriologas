// src/app/api/orders/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: "No autorizado" }, { status: 401 });
  const userId = session.user.id!;
  const tenantId = (session.user as any).tenantId;
  const orders = await prisma.order.findMany({
    where: { userId, tenantId },
    include: { items: { include: { product: { select: { name: true, images: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(orders);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: "No autorizado" }, { status: 401 });
  const userId = session.user.id!;
  const tenantId = (session.user as any).tenantId;
  const { items, paymentMethod, paymentReference, shippingAddress } = await req.json();

  // Calcular total desde la DB (nunca confiar en el cliente)
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i: any) => i.productId) }, tenantId },
  });
  const total = items.reduce((sum: number, item: any) => {
    const product = products.find((p) => p.id === item.productId);
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);

  const order = await prisma.order.create({
    data: {
      userId, tenantId, total, paymentMethod, paymentReference, shippingAddress, status: "PAID",
      items: { create: items.map((i: any) => ({ productId: i.productId, quantity: i.quantity, unitPrice: products.find(p => p.id === i.productId)?.price ?? 0 })) },
    },
    include: { items: true },
  });

  return Response.json(order, { status: 201 });
}
