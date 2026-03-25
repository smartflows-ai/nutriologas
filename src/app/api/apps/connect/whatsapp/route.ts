// src/app/api/apps/connect/whatsapp/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return Response.json({ error: "No autorizado" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  const userId = (session.user as any).id as string;

  // Obtener el slug del tenant para el webhook
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true, name: true },
  });
  if (!tenant) return Response.json({ error: "Tenant no encontrado" }, { status: 404 });

  const instanceName = `${tenant.slug}-${tenantId}`;
  const webhookUrl = `${process.env.N8N_WEBHOOK_BASE_URL}/${tenant.slug}-${tenantId}`;

  // Crear instancia en Evolution API
  const createRes = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": EVOLUTION_API_KEY,
    },
    body: JSON.stringify({
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      alwaysOnline: true,
      readMessages: true,
      readStatus: true,
      webhook: {
        url: webhookUrl,
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT"],
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    return Response.json({ error: `Evolution API error: ${err}` }, { status: 500 });
  }

  const data = await createRes.json();
  const qrCode = data.qrcode?.base64 ?? null;

  // Guardar en connected_apps
  await prisma.connectedApp.upsert({
    where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
    update: {
      accessToken: EVOLUTION_API_KEY,
      waInstanceId: instanceName,
      waInstanceName: instanceName,
      waStatus: qrCode ? "qr_pending" : "connecting",
      waQrCode: qrCode,
      waWebhookUrl: webhookUrl,
      connectedByUserId: userId,
      metadata: { instanceName, webhookUrl },
    },
    create: {
      tenantId,
      provider: "WHATSAPP",
      accessToken: EVOLUTION_API_KEY,
      waInstanceId: instanceName,
      waInstanceName: instanceName,
      waStatus: qrCode ? "qr_pending" : "connecting",
      waQrCode: qrCode,
      waWebhookUrl: webhookUrl,
      connectedByUserId: userId,
      scopes: "WHATSAPP",
      metadata: { instanceName, webhookUrl },
    },
  });

  return Response.json({ qrCode, instanceName, webhookUrl });
}
