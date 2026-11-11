// src/app/api/products/[id]/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { productBaseSchema } from "@/lib/validations";
import { normalizePriceInput } from "@/lib/price-display";
import { isValidAssessmentTarget } from "@/lib/assessment-target";
import { deleteImageFromCloudinary } from "@/lib/cloudinary";
import { z } from "zod";

// Override isActive without a default so false is never replaced by a default value
const updateProductSchema = productBaseSchema.extend({ isActive: z.boolean().optional() }).partial();

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 401 });

  const tenantId = (session.user as any).tenantId;
  const body = await req.json();
  const data = updateProductSchema.parse(body);

  // The price fields depend on each other and on the item type (a free price is only for non-physical items).
  const existing = await prisma.product.findFirst({ where: { id: params.id, tenantId }, select: { itemType: true } });
  if (!existing) return Response.json({ error: "product_not_found" }, { status: 404 });
  const priceRule = normalizePriceInput({ ...data, itemType: data.itemType ?? existing.itemType }, { partial: true });
  if (!priceRule.ok) return Response.json({ error: "validation_failed" }, { status: 400 });
  const targetId = priceRule.value.assessmentProductId ?? null;
  if (targetId && !(await isValidAssessmentTarget(tenantId, params.id, targetId))) {
    return Response.json({ error: "assessment_target_invalid" }, { status: 400 });
  }

  const product = await prisma.product.update({
    where: { id: params.id, tenantId },
    data: {
      ...data,
      ...priceRule.value,
      serviceConfig: data.serviceConfig ?? undefined,
    } as any,
  });

  return Response.json(product);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 401 });

  const tenantId = (session.user as any).tenantId;

  const product = await prisma.product.findUnique({
    where: { id: params.id, tenantId },
  });

  if (product && product.images && product.images.length > 0) {
    // Borrar físicamente las imágenes de Cloudinary
    for (const image of product.images) {
      await deleteImageFromCloudinary(image);
    }
  }

  const [orderItems, reviews, appointments] = await Promise.all([
    prisma.orderItem.count({ where: { productId: params.id } }),
    prisma.review.count({ where: { productId: params.id } }),
    prisma.appointment.count({ where: { productId: params.id } }),
  ]);

  if (orderItems + reviews + appointments === 0) {
    await prisma.product.delete({ where: { id: params.id, tenantId } });
    return Response.json({ ok: true, deleted: "hard" });
  }

  await prisma.product.update({
    where: { id: params.id, tenantId },
    data: { deletedAt: new Date(), isActive: false, images: [] },
  });

  return Response.json({ ok: true, deleted: "soft" });
}
