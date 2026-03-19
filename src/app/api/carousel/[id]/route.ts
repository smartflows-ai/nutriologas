// src/app/api/carousel/[id]/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteImageFromCloudinary } from "@/lib/cloudinary";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return Response.json({ error: "No autorizado" }, { status: 401 });
  const tenantId = (session.user as any).tenantId;

  const image = await prisma.carouselImage.findUnique({
    where: { id: params.id, tenantId },
  });

  if (image?.url) {
    await deleteImageFromCloudinary(image.url);
  }

  // Hard delete: borrado permanente ya que no afecta relaciones como los productos
  await prisma.carouselImage.delete({
    where: { id: params.id, tenantId },
  });
  return Response.json({ ok: true });
}
