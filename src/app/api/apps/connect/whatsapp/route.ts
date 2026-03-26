// src/app/api/apps/connect/whatsapp/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

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

  // 1. Verificar si la instancia ya existe
  const checkRes = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
    method: "GET",
    headers: { "apikey": EVOLUTION_API_KEY },
  });

  let qrCode = null;
  let status = "connecting";

  if (checkRes.ok) {
    const checkData = await checkRes.json();
    console.log("[whatsapp-connect] Instance exists, state:", checkData.instance?.state);

    if (checkData.instance?.state === "open") {
      // Ya esta conectado!
      status = "connected";
    } else {
      // Existe pero no esta conectado, pedimos QR fresco
      console.log("[whatsapp-connect] Instance exists but not open, requesting QR...");
      const qrRes = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
        method: "GET",
        headers: { "apikey": EVOLUTION_API_KEY },
      });
      const qrData = await qrRes.json();
      
      // Evolution API a veces devuelve la base64 directamente o en un objeto code
      qrCode = qrData.base64 || qrData.code || (typeof qrData === 'string' ? qrData : null);
      
      if (!qrCode && qrData.pairingCode) {
         // Si no hay QR pero hay codigo de emparejamiento, lo mencionamos (opcional)
         console.warn("[whatsapp-connect] No QR found, only pairing code");
      }

      console.log("[whatsapp-connect] QR fetched:", !!qrCode);
      status = qrCode ? "qr_pending" : "connecting";
    }
  } else {
    // No existe, creamos
    console.log("[whatsapp-connect] Instance does not exist, creating...");
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
      console.error("[whatsapp-connect] Create error:", err);
      if (!err.includes("already exists")) {
        return Response.json({ error: `Error al crear instancia: ${err}` }, { status: 500 });
      }
    } else {
      const data = await createRes.json();
      console.log("[whatsapp-connect] Create success, has qr:", !!data.qrcode?.base64);
      qrCode = data.qrcode?.base64 ?? null;
      status = qrCode ? "qr_pending" : "connecting";
    }
  }

  // Guardar en connected_apps
  await prisma.connectedApp.upsert({
    where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
    update: {
      accessToken: EVOLUTION_API_KEY,
      waInstanceId: instanceName,
      waInstanceName: instanceName,
      waStatus: status,
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
      waStatus: status,
      waQrCode: qrCode,
      waWebhookUrl: webhookUrl,
      connectedByUserId: userId,
      scopes: "WHATSAPP",
      metadata: { instanceName, webhookUrl },
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/apps");
  revalidatePath("/admin", "layout");

  return Response.json({ qrCode, status, instanceName, webhookUrl });
}
