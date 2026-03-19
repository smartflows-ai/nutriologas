// src/app/api/products/[id]/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { productSchema } from "@/lib/validations";
import { deleteImageFromCloudinary } from "@/lib/cloudinary";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 401 });

  const tenantId = (session.user as any).tenantId;
  const body = await req.json();
  const data = productSchema.partial().parse(body);

  const product = await prisma.product.update({
    where: { id: params.id, tenantId },
    data,
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

  // Soft delete
  await prisma.product.update({
    where: { id: params.id, tenantId },
    data: { deletedAt: new Date(), isActive: false, images: [] },
  });

  return Response.json({ ok: true });
}
