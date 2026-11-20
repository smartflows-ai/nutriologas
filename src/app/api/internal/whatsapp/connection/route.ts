// src/app/api/internal/whatsapp/connection/route.ts
// Ban prevention: connection events (CONNECTION_UPDATE) from the Evolution webhook, forwarded by n8n.
// Authenticated with the internal key. Tenant comes from the instance name, never from the body's free text.
import { prisma } from "@/lib/db";
import { isInternalKeyValid } from "@/lib/bot";
import { connectionEffectOf, connectionPatchOf } from "@/lib/messaging/connection";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const instance = typeof body?.instance === "string" ? body.instance : null;
  const data = body?.data ?? {};
  const state = data.state;
  if (!instance || (state !== "open" && state !== "connecting" && state !== "close")) {
    return Response.json({ error: "Evento de conexión incompleto" }, { status: 400 });
  }
  const statusCode = typeof data.statusReason === "number" ? data.statusReason : typeof data.statusCode === "number" ? data.statusCode : null;

  const app = await prisma.connectedApp.findFirst({
    where: { provider: "WHATSAPP", OR: [{ waInstanceName: instance }, { waInstanceId: instance }] },
    select: { id: true },
  });
  if (!app) return Response.json({ error: "Instancia no encontrada" }, { status: 404 });

  const effect = connectionEffectOf({ state, statusCode });
  const patch = connectionPatchOf(effect, new Date());
  if (Object.keys(patch).length > 0) await prisma.connectedApp.update({ where: { id: app.id }, data: patch });
  return Response.json({ effect: effect.kind });
}
