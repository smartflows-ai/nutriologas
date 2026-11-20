// src/app/api/apps/whatsapp/risk/route.ts
// Ban prevention: the state the owner sees (status card) and the business kill switch (pause this business's sends).
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { NextRequest } from "next/server";

export async function GET() {
  const access = await requirePermission("whatsapp.settings");
  if (!access.ok) return access.response;
  const { tenantId } = access;

  const [app, tenant] = await Promise.all([
    prisma.connectedApp.findUnique({
      where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
      select: {
        riskState: true,
        statusReason: true,
        sendingPausedAt: true,
        consecutiveFailures: true,
        lastSuccessfulSendAt: true,
        lastConnectedAt: true,
        lastDisconnectedAt: true,
        killSwitch: true,
      },
    }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { whatsappKillSwitch: true } }),
  ]);
  if (!app) return Response.json({ error: "WhatsApp no conectado" }, { status: 404 });

  // The global switch is an operator decision: only its on/off state is shown, never who turned it on.
  const flags = await prisma.platformFlag.findUnique({ where: { id: "global" }, select: { globalKillSwitch: true } });
  return Response.json({
    riskState: app.riskState,
    statusReason: app.statusReason,
    sendingPausedAt: app.sendingPausedAt,
    consecutiveFailures: app.consecutiveFailures,
    lastSuccessfulSendAt: app.lastSuccessfulSendAt,
    lastConnectedAt: app.lastConnectedAt,
    lastDisconnectedAt: app.lastDisconnectedAt,
    instanceKillSwitch: app.killSwitch,
    businessKillSwitch: tenant?.whatsappKillSwitch ?? false,
    globalKillSwitch: flags?.globalKillSwitch ?? false,
  });
}

export async function PATCH(req: NextRequest) {
  const access = await requirePermission("whatsapp.settings");
  if (!access.ok) return access.response;
  const { tenantId } = access;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.businessKillSwitch !== "boolean") {
    return Response.json({ error: "businessKillSwitch debe ser true o false" }, { status: 400 });
  }
  await prisma.tenant.update({ where: { id: tenantId }, data: { whatsappKillSwitch: body.businessKillSwitch } });
  return Response.json({ businessKillSwitch: body.businessKillSwitch });
}
