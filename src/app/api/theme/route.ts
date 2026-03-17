// src/app/api/theme/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { themeSchema } from "@/lib/validations";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("tenant") ?? "clinica-demo";
  const tenant = await prisma.tenant.findUnique({ where: { slug }, include: { theme: true } });
  return Response.json(tenant?.theme ?? { primaryColor: "#16a34a", secondaryColor: "#15803d", accentColor: "#4ade80" });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  const body = await req.json();
  const data = themeSchema.parse(body);
  const theme = await prisma.themeConfig.upsert({
    where: { tenantId },
    update: data,
    create: { tenantId, ...data },
  });
  return Response.json(theme);
}
