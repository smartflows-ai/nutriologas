import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  let tenantId: string | null = (session?.user as any)?.tenantId ?? null;

  if (!tenantId) {
    const host = req.headers.get("host") || "";
    let tenantSlug = "clinica-demo";
    if (host.includes(".localhost")) tenantSlug = host.split(".")[0];
    else if (!host.includes("localhost")) tenantSlug = host.split(":")[0];

    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] },
    });
    if (!tenant) return Response.json([]);
    tenantId = tenant.id;
  }

  const faqs = await (prisma as any).fAQ.findMany({
    where: { tenantId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return Response.json(faqs);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  const { question, answer } = await req.json();
  const count = await (prisma as any).fAQ.count({ where: { tenantId } });
  const faq = await (prisma as any).fAQ.create({ data: { tenantId, question, answer, sortOrder: count } });
  return Response.json(faq, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  const { order } = await req.json();
  if (Array.isArray(order)) {
    await Promise.all(
      order.map((item: any) =>
        (prisma as any).fAQ.update({ where: { id: item.id, tenantId }, data: { sortOrder: item.sortOrder } })
      )
    );
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Formato inválido" }, { status: 400 });
}
