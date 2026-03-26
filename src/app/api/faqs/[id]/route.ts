import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  const { question, answer, isActive } = await req.json();
  const faq = await (prisma as any).fAQ.update({
    where: { id: params.id, tenantId },
    data: { question, answer, isActive },
  });
  return Response.json(faq);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  await (prisma as any).fAQ.delete({
    where: { id: params.id, tenantId },
  });
  return Response.json({ success: true });
}
