// src/app/api/apps/connect/whatsapp/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import https from "https";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;

// Allow self-signed / expired certs on Evolution API (no SSL in dev)
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

// Thin wrapper so every Evolution call skips TLS validation
function evoFetch(url: string, init?: RequestInit) {
  return fetch(url, { ...(init ?? {}), ...(({ agent: insecureAgent }) as any) });
}

export async function POST(req: NextRequest) {
  try {
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
    let checkRes;
    let existingInstance: any = null;
    try {
      const fetchInstRes = await evoFetch(`${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${instanceName}`, {
        method: "GET",
        headers: { apikey: EVOLUTION_API_KEY },
      });
      if (fetchInstRes.ok) {
        const instList = await fetchInstRes.json();
        existingInstance = Array.isArray(instList)
          ? instList.find((i: any) => i.name === instanceName || i.id === instanceName) || instList[0]
          : instList;
      }
    } catch (err: any) {
      console.warn("[whatsapp-connect] fetchInstances check warning:", err.message);
    }

    let qrCode: string | null = null;
    let status = "connecting";

    if (existingInstance && (existingInstance.name === instanceName || existingInstance.id === instanceName)) {
      if (existingInstance.connectionStatus === "open" || existingInstance.state === "open") {
        // Ya está conectado
        status = "connected";
      } else {
        // Existe pero no está conectado, solicitamos QR fresco
        const qrRes = await evoFetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
          method: "GET",
          headers: { apikey: EVOLUTION_API_KEY },
        });

        if (qrRes.ok) {
          const qrData = await qrRes.json();
          qrCode = qrData.base64 || qrData.code || (typeof qrData === "string" ? qrData : null);
          status = qrCode ? "qr_pending" : "connecting";
        }
      }
    } else {
      // No existe, creamos con las banderas requeridas:
      // MESSAGES_UPSERT, Webhook Base64: true, Reject Calls: true, Ignore Groups: true, Read Messages: true, Always Online: true, Read Status: false
      const createRes = await evoFetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          rejectCall: true,
          groupsIgnore: true,
          alwaysOnline: true,
          readMessages: true,
          readStatus: false,
          syncFullHistory: false,
          webhook: {
            url: webhookUrl,
            byEvents: false,
            base64: true,
            events: ["MESSAGES_UPSERT"],
          },
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        if (!err.includes("already exists")) {
          return Response.json({ error: "No se pudo inicializar la conexión de WhatsApp." }, { status: 500 });
        }
      } else {
        try {
          const data = await createRes.json();
          qrCode = data.qrcode?.base64 ?? null;
          status = qrCode ? "qr_pending" : "connecting";
        } catch {
          return Response.json({ error: "No se pudo inicializar la conexión de WhatsApp." }, { status: 502 });
        }
      }
    }

    // Asegurar banderas requeridas en Settings de Evolution API
    try {
      await evoFetch(`${EVOLUTION_API_URL}/settings/set/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({
          rejectCall: true,
          groupsIgnore: true,
          alwaysOnline: true,
          readMessages: true,
          readStatus: false,
          syncFullHistory: false,
        }),
      });
    } catch (e) {
      console.warn("[whatsapp-connect] settings/set warning:", e);
    }

    // Asegurar banderas requeridas en Webhook de Evolution API (MESSAGES_UPSERT + base64)
    try {
      await evoFetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: true,
            events: ["MESSAGES_UPSERT"],
          },
        }),
      });
    } catch (e) {
      console.warn("[whatsapp-connect] webhook/set warning:", e);
    }

    // A new code starts its own lifetime; refreshes are counted from zero.
    const qrMeta = qrCode ? { qrIssuedAt: Date.now(), qrRefreshes: 0 } : {};

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
        metadata: { instanceName, webhookUrl, ...qrMeta },
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
        metadata: { instanceName, webhookUrl, ...qrMeta },
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/apps");
    revalidatePath("/admin", "layout");

    return Response.json({ qrCode, status, instanceName, webhookUrl });
  } catch (err: any) {
    console.error("[whatsapp-connect] Unhandled error:", err.message);
    return Response.json({ error: "Error interno al conectar WhatsApp" }, { status: 500 });
  }
}
