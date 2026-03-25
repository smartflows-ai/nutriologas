// src/app/api/apps/whatsapp/status/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN")
    return Response.json({ error: "No autorizado" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;

  const app = await prisma.connectedApp.findUnique({
    where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
  });

  if (!app?.waInstanceId)
    return Response.json({ status: "disconnected" });

  // Consultar estado real en Evolution API
  const statusRes = await fetch(
    `${EVOLUTION_API_URL}/instance/connectionState/${app.waInstanceId}`,
    { headers: { apikey: EVOLUTION_API_KEY } }
  );

  if (!statusRes.ok) return Response.json({ status: "disconnected" });

  const statusData = await statusRes.json();
  const isConnected = statusData.instance?.state === "open";

  // Si ya conectó, obtener el número y limpiar el QR
  if (isConnected && app.waStatus !== "connected") {
    const infoRes = await fetch(
      `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${app.waInstanceId}`,
      { headers: { apikey: EVOLUTION_API_KEY } }
    );
    const infoData = infoRes.ok ? await infoRes.json() : [];
    const phone = infoData[0]?.instance?.profilePictureUrl
      ? infoData[0]?.instance?.number
      : null;

    await prisma.connectedApp.update({
      where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
      data: {
        waStatus: "connected",
        waQrCode: null, // limpiar QR
        waPhoneNumber: phone,
      },
    });
  }

  // Si sigue pendiente de QR, refrescar el QR
  if (!isConnected && app.waStatus === "qr_pending") {
    const qrRes = await fetch(
      `${EVOLUTION_API_URL}/instance/connect/${app.waInstanceId}`,
      { headers: { apikey: EVOLUTION_API_KEY } }
    );
    if (qrRes.ok) {
      const qrData = await qrRes.json();
      if (qrData.base64) {
        await prisma.connectedApp.update({
          where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
          data: { waQrCode: qrData.base64 },
        });
        return Response.json({ status: "qr_pending", qrCode: qrData.base64 });
      }
    }
  }

  return Response.json({
    status: isConnected ? "connected" : app.waStatus,
    qrCode: app.waQrCode,
    phoneNumber: app.waPhoneNumber,
    instanceName: app.waInstanceId,
    webhookUrl: app.waWebhookUrl,
  });
}
