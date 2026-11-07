// src/app/api/apps/whatsapp/config/route.ts
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { NextRequest } from "next/server";

// GET returns the bot's identity text (waContext), so it shares the settings permission with PATCH.
export async function GET(req: NextRequest) {
  const access = await requirePermission("whatsapp.settings");
  if (!access.ok) return access.response;
  const { tenantId } = access;

  const app = await prisma.connectedApp.findUnique({
    where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
    select: { waTemperature: true, waContext: true, waStatus: true, waPhoneNumber: true },
  });

  if (!app) return Response.json({ error: "WhatsApp no conectado" }, { status: 404 });

  return Response.json(app);
}

export async function PATCH(req: NextRequest) {
  const access = await requirePermission("whatsapp.settings");
  if (!access.ok) return access.response;
  const { tenantId } = access;
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
