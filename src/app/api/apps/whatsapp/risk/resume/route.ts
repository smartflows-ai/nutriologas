// src/app/api/apps/whatsapp/risk/resume/route.ts
// Ban prevention: a person reviews a paused instance and resumes sending. Nothing resumes it by itself.
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { resumePatch } from "@/lib/messaging/connection";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const access = await requirePermission("whatsapp.settings");
  if (!access.ok) return access.response;
  const { tenantId, session } = access;
  const body = await req.json().catch(() => null);
  if (!body || body.confirmReviewed !== true) {
    return Response.json({ error: "Confirma que revisaste la causa antes de reanudar" }, { status: 400 });
  }

  const patch = resumePatch(session.user.email ?? session.user.id ?? "reviewed");
  if (!patch) return Response.json({ error: "Falta quién revisa" }, { status: 400 });
  const updated = await prisma.connectedApp.updateMany({ where: { tenantId, provider: "WHATSAPP" }, data: patch });
  if (updated.count === 0) return Response.json({ error: "WhatsApp no conectado" }, { status: 404 });
  return Response.json({ riskState: "NORMAL" });
}
