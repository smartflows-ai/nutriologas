// src/app/api/reviews/[id]/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return Response.json({ error: "No autorizado" }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  const { isVisible } = await req.json();
  const review = await prisma.review.update({
    where: { id: params.id, tenantId },
    data: { isVisible },
  });
  return Response.json(review);
}
