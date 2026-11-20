// src/app/api/apps/whatsapp/config/route.ts
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { NextRequest } from "next/server";
import { evolutionConfigFromEnv, fetchInstanceInfo } from "@/lib/messaging/evolution-adapter";
import { needsPhoneBackfill } from "@/lib/whatsapp-phone";

// GET returns the bot's identity text (waContext), so it shares the settings permission with PATCH.
export async function GET(req: NextRequest) {
  const access = await requirePermission("whatsapp.settings");
  if (!access.ok) return access.response;
  const { tenantId } = access;

  const app = await prisma.connectedApp.findUnique({
    where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
    select: { waTemperature: true, waContext: true, waStatus: true, waPhoneNumber: true, waInstanceId: true },
  });

  if (!app) return Response.json({ error: "WhatsApp no conectado" }, { status: 404 });

  // A connected line with no saved number (QA 2026-11-20): ask Evolution once and keep it. Best effort: a failed
  // lookup leaves the screen showing "Conectado" without a number.
  let waPhoneNumber = app.waPhoneNumber;
  if (needsPhoneBackfill(app)) {
    const cfg = evolutionConfigFromEnv();
    const info = cfg ? await fetchInstanceInfo(cfg, app.waInstanceId as string).catch(() => null) : null;
    if (info?.phone) {
      waPhoneNumber = info.phone;
      await prisma.connectedApp.update({
        where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
        data: { waPhoneNumber },
      });
    }
  }

  // The instance id stays on the server.
  const { waInstanceId: _instance, ...visible } = app;
  return Response.json({ ...visible, waPhoneNumber });
}

export async function PATCH(req: NextRequest) {
  const access = await requirePermission("whatsapp.settings");
  if (!access.ok) return access.response;
  const { tenantId } = access;
  const { waTemperature, waContext } = await req.json();

  // select only the settings fields: the row also holds accessToken (the instance credential).
  const updated = await prisma.connectedApp.update({
    where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
    data: {
      waTemperature: typeof waTemperature === 'number' ? waTemperature : undefined,
      waContext: typeof waContext === 'string' ? waContext : undefined,
    },
    select: { waTemperature: true, waContext: true, waStatus: true, waPhoneNumber: true },
  });

  return Response.json(updated);
}
