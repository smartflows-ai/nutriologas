// src/app/api/theme/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { themeSchema } from "@/lib/validations";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  // Session-first (admin panel), then host-based for public
  const session = await getServerSession(authOptions);
  let tenantId: string | null = (session?.user as any)?.tenantId ?? null;
  let themeResult;

  if (tenantId) {
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, include: { theme: true } });
    themeResult = tenant?.theme;
  } else {
    const host = req.headers.get("host") || "";
    let tenantSlug = "clinica-demo";
    if (host.includes(".localhost")) tenantSlug = host.split(".")[0];
    else if (!host.includes("localhost")) tenantSlug = host.split(":")[0];
    const tenant = await prisma.tenant.findFirst({ 
      where: { OR: [{ slug: tenantSlug }, { customDomain: tenantSlug }] }, 
      include: { theme: true } 
    });
    themeResult = tenant?.theme;
  }

  return Response.json(themeResult ?? { primaryColor: "#16a34a", secondaryColor: "#15803d", accentColor: "#4ade80" });
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
