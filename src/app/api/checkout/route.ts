// src/app/api/checkout/route.ts
// Initiates a Conekta hosted payment checkout.
// Returns { orderId, checkoutRequestId } so the frontend can mount the iframe.
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createConektaCustomer,
  createConektaOrder,
  getConektaOrder,
} from "@/lib/conekta";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = session.user.id!;
  const tenantId = (session.user as any).tenantId;
  const { items, paymentMethod } = await req.json();

  // Build the base URL preserving the tenant subdomain (e.g. doctor.localhost:3000)
  const host = (req as any).headers?.get?.("host") ?? (req.headers as any)?.host ?? "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const tenantBaseUrl = host ? `${protocol}://${host}` : (process.env.NEXTAUTH_URL ?? "http://localhost:3000");

  if (!items?.length) {
    return Response.json({ error: "Carrito vacío" }, { status: 400 });
  }

  // Check for existing pending orders to prevent duplicates
  const existingPendingOrder = await prisma.order.findFirst({
    where: {
      userId,
      status: "PENDING",
      createdAt: {
        gte: new Date(Date.now() - 30 * 60 * 1000), // Last 30 minutes
      },
    },
    include: {
      items: true,
    },
  });

  // If there's a recent pending order with the same items, reuse it
  if (existingPendingOrder) {
    const sameItems = existingPendingOrder.items.every((item) =>
      items.some(
        (i: any) =>
          i.productId === item.productId && i.quantity === item.quantity,
      ),
    );

    if (sameItems && existingPendingOrder.paymentReference) {
      // Fetch the Conekta order to get the checkoutRequestId
      try {
        const conektaOrder = await getConektaOrder(
          existingPendingOrder.paymentReference,
        );
        return Response.json({
          orderId: existingPendingOrder.id,
          checkoutRequestId: conektaOrder.checkout?.id,
        });
      } catch (err) {
        // Continue to create new order - the expired one will be handled below
      }
    }

    // Cancel the existing pending order (restore stock)
    await prisma.$transaction(async (tx) => {
      // Restore stock
      for (const item of existingPendingOrder.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
      // Delete order items and order
      await tx.orderItem.deleteMany({
        where: { orderId: existingPendingOrder.id },
      });
      await tx.order.delete({ where: { id: existingPendingOrder.id } });
    });
  }

  // Verify prices from DB — never trust the client
  const products = await prisma.product.findMany({
    where: {
      id: { in: items.map((i: any) => i.productId) },
      tenantId,
      isActive: true,
    },
  });

  if (products.length !== items.length) {
    return Response.json(
      { error: "Uno o más productos no están disponibles" },
      { status: 400 },
    );
  }

  // Validate stock availability before proceeding
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)!;
    if (product.stock < item.quantity) {
      return Response.json(
        {
          error: `Stock insuficiente para "${product.name}". Disponible: ${product.stock}`,
        },
        { status: 400 },
      );
    }
  }

  const total = items.reduce((sum: number, item: any) => {
    const product = products.find((p) => p.id === item.productId);
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);

  // Get or lazily create the Conekta customer for this user
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)
    return Response.json({ error: "Usuario no encontrado" }, { status: 404 });

  let conektaCustomerId = user.conektaCustomerId;
  if (!conektaCustomerId) {
    try {
      const customer = await createConektaCustomer({
        name: user.name ?? user.email,
        email: user.email,
      });
      conektaCustomerId = customer.id as string;
      await prisma.user.update({
        where: { id: userId },
        data: { conektaCustomerId },
      });
    } catch (err: any) {
      console.error(
        "Conekta createCustomer error:",
        err?.response?.data ?? err,
      );
      return Response.json(
        { error: "Error al crear perfil de pago" },
        { status: 500 },
      );
    }
  }

  // Atomic transaction: decrement stock + create order
  // Uses optimistic locking — if stock changed between validation and decrement, the
  // updateMany WHERE clause won't match and we roll back.
  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      // Atomically decrement stock for each item
      for (const item of items) {
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (updated.count === 0) {
          const product = products.find((p) => p.id === item.productId)!;
          throw new Error(`Stock insuficiente para "${product.name}"`);
        }
      }

      // Create the DB order in PENDING status
      return tx.order.create({
        data: {
          userId,
          tenantId,
          total,
          paymentMethod:
            paymentMethod === "OXXO_CONEKTA" ? "OXXO_CONEKTA" : "CARD_CONEKTA",
          status: "PENDING",
          items: {
            create: items.map((i: any) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: products.find((p) => p.id === i.productId)?.price ?? 0,
            })),
          },
        },
      });
    });
  } catch (err: any) {
    console.error("Stock/order transaction error:", err.message);
    return Response.json(
      { error: err.message || "Error al crear el pedido" },
      { status: 400 },
    );
  }

  // Build Conekta line items (amounts in centavos)
  const lineItems = items.map((i: any) => {
    const product = products.find((p) => p.id === i.productId)!;
    return {
      name: product.name,
      unit_price: Math.round(product.price * 100),
      quantity: i.quantity,
    };
  });

  const allowedPaymentMethods =
    paymentMethod === "OXXO_CONEKTA" ? ["cash"] : ["card"];

  try {
    const conektaOrder = await createConektaOrder({
      customerId: conektaCustomerId,
      referenceId: order.id,
      lineItems,
      allowedPaymentMethods,
      baseUrl: tenantBaseUrl,
    });

    // Persist Conekta order ID
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentReference: conektaOrder.id },
    });

    return Response.json({
      orderId: order.id,
      checkoutRequestId: conektaOrder.checkout?.id,
    });
  } catch (err: any) {
    // Conekta failed — restore stock and clean up order
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
      // Delete order items first, then order
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      await tx.order.delete({ where: { id: order.id } });
    });
    console.error("Conekta createOrder error:", err?.response?.data ?? err);
    return Response.json(
      { error: "Error al crear la orden de pago" },
      { status: 500 },
    );
  }
}
