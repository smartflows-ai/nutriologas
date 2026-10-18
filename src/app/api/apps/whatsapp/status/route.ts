// src/app/api/apps/whatsapp/status/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import https from "https";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;

const insecureAgent = new https.Agent({ rejectUnauthorized: false });
function evoFetch(url: string, init?: RequestInit) {
  return fetch(url, { ...(init ?? {}), ...(({ agent: insecureAgent }) as any) });
}

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

  let isConnected = false;
  let phoneNumber: string | null = app.waPhoneNumber;

  // 1. Consultar estado real en Evolution API vía fetchInstances (más confiable y contiene ownerJid)
  try {
    const infoRes = await evoFetch(
      `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${app.waInstanceId}`,
      { headers: { apikey: EVOLUTION_API_KEY } }
    );
    if (infoRes.ok) {
      const infoData = await infoRes.json();
      const inst = Array.isArray(infoData)
        ? infoData.find((i: any) => i.name === app.waInstanceId || i.id === app.waInstanceId) || infoData[0]
        : infoData;

      if (inst) {
        const state = inst.connectionStatus || inst.state || inst.instance?.state;
        if (state === "open") {
          isConnected = true;
        }
        const rawPhone = inst.ownerJid || inst.number || inst.instance?.ownerJid || inst.instance?.number;
        if (rawPhone) {
          phoneNumber = rawPhone.replace(/@.*$/, "").replace(/\D/g, "");
        }
      }
    }
  } catch (err: any) {
    console.warn("[whatsapp-status] fetchInstances error:", err.message);
  }

  // 2. Si fetchInstances no indicó open, verificar connectionState
  if (!isConnected) {
    try {
      const statusRes = await evoFetch(
        `${EVOLUTION_API_URL}/instance/connectionState/${app.waInstanceId}`,
        { headers: { apikey: EVOLUTION_API_KEY } }
      );
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const state = statusData.instance?.state || statusData.state || statusData.connectionStatus;
        if (state === "open") {
          isConnected = true;
        }
      }
    } catch (err: any) {
      console.warn("[whatsapp-status] connectionState error:", err.message);
    }
  }

  // Si ya conectó, actualizar base de datos y limpiar QR
  if (isConnected) {
    if (app.waStatus !== "connected" || app.waQrCode !== null || (phoneNumber && !app.waPhoneNumber)) {
      await prisma.connectedApp.update({
        where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
        data: {
          waStatus: "connected",
          waQrCode: null, // limpiar QR
          waPhoneNumber: phoneNumber || app.waPhoneNumber,
        },
      });

      revalidatePath("/admin");
      revalidatePath("/admin/apps");
      revalidatePath("/admin", "layout");
    }

    return Response.json({
      status: "connected",
      phoneNumber: phoneNumber || app.waPhoneNumber,
      instanceName: app.waInstanceId,
      webhookUrl: app.waWebhookUrl,
    });
  }

  return Response.json({
    status: app.waStatus || "disconnected",
    qrCode: app.waQrCode,
    phoneNumber: app.waPhoneNumber,
    instanceName: app.waInstanceId,
    webhookUrl: app.waWebhookUrl,
  });
}
