// src/app/api/pedido/[id]/route.ts
// API endpoint para obtener el estado actual del pedido (usado para polling en tiempo real)
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const order = await prisma.order.findFirst({
      where: { id, userId: session.user.id! },
      select: {
        id: true,
        status: true,
        paymentMethod: true,
        paymentReference: true,
        total: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("[Pedido API] Error fetching order:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
