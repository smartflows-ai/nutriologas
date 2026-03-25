// src/app/api/apps/whatsapp/config/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return Response.json({ error: "No autorizado" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;

  const app = await prisma.connectedApp.findUnique({
    where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
    select: { waTemperature: true, waContext: true, waStatus: true, waPhoneNumber: true },
  });

  if (!app) return Response.json({ error: "WhatsApp no conectado" }, { status: 404 });

  return Response.json(app);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return Response.json({ error: "No autorizado" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  const { waTemperature, waContext } = await req.json();

  const updated = await prisma.connectedApp.update({
    where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
    data: {
      waTemperature: typeof waTemperature === 'number' ? waTemperature : undefined,
      waContext: typeof waContext === 'string' ? waContext : undefined,
    },
  });

  return Response.json(updated);
}
