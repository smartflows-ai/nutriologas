// src/app/api/reviews/[id]/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-errors";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return apiError("unauthorized", 401);
  const tenantId = (session.user as any).tenantId;
  const { isVisible } = await req.json();
  const review = await prisma.review.update({
    where: { id: params.id, tenantId },
    data: { isVisible },
  });
  return Response.json(review);
}
