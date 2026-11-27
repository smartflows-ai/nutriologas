// src/app/api/apps/connect/whatsapp/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  connectQr,
  createInstance,
  evolutionConfigFromEnv,
  fetchInstanceInfo,
  instanceKeyOf,
  setSettings,
  setWebhook,
  webhookHeaders,
} from "@/lib/messaging/evolution-adapter";
import { mediaEnabledFor } from "@/lib/wa-media-data";
import { WEBHOOK_BASE64_META } from "@/lib/wa-webhook-rev";

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

    const cfg = evolutionConfigFromEnv();
    if (!cfg) return Response.json({ error: "No se pudo inicializar la conexión de WhatsApp." }, { status: 503 });

    const instanceName = `${tenant.slug}-${tenantId}`;
    const webhookUrl = `${process.env.N8N_WEBHOOK_BASE_URL}/${tenant.slug}-${tenantId}`;
    // Evolution signs every webhook call with a short-lived JWT; n8n verifies it.
    const hookHeaders = webhookHeaders(process.env.EVOLUTION_WEBHOOK_SECRET);
    if (!hookHeaders.jwt_key) console.error("[whatsapp-connect] EVOLUTION_WEBHOOK_SECRET not set: webhook calls are unsigned; set it before enabling JWT Auth on the n8n trigger");
    // #154: the file travels in the webhook only for businesses that are off; the ones on get it by key (#182).
    // The same list drives the 15-minute round (wa-webhook-rev.ts), so a line connected early never gets it first.
    const webhookBase64 = !mediaEnabledFor(tenantId);

    let qrCode: string | null = null;
    let status = "connecting";
    // The instance's own token. The global key is never stored.
    let instanceToken: string | null = null;

    // 1. Existing instance: reuse it (connected, or ask for a fresh code).
    const existing = await fetchInstanceInfo(cfg, instanceName);
    if (existing) {
      instanceToken = existing.token;
      if (existing.state === "open") {
        status = "connected";
      } else {
        qrCode = await connectQr(cfg, { instance: instanceName, apiKey: instanceKeyOf(instanceToken, cfg.globalKey) });
        status = qrCode ? "qr_pending" : "connecting";
      }
    } else {
      // 2. New instance with the required flags and the signed webhook.
      const created = await createInstance(cfg, { instance: instanceName, webhookUrl, headers: hookHeaders, base64: webhookBase64 });
      if (!created.ok) {
        // Created at the same moment by another request: read it back instead of failing.
        const raced = await fetchInstanceInfo(cfg, instanceName);
        if (!raced) {
          console.error("[whatsapp-connect] create failed:", created.error, created.status ?? "");
          return Response.json({ error: "No se pudo inicializar la conexión de WhatsApp." }, { status: 502 });
        }
        instanceToken = raced.token;
        if (raced.state === "open") status = "connected";
      } else {
        instanceToken = created.token;
        qrCode = created.qrCode;
        status = qrCode ? "qr_pending" : "connecting";
      }
    }

    // 3. Make sure settings and the signed webhook are in place (also on instances created before).
    const instanceKey = instanceKeyOf(instanceToken, cfg.globalKey);
    if (!(await setSettings(cfg, { instance: instanceName, apiKey: instanceKey }))) {
      console.warn("[whatsapp-connect] settings/set did not apply");
    }
    const webhookApplied = await setWebhook(cfg, { instance: instanceName, apiKey: instanceKey, url: webhookUrl, headers: hookHeaders, base64: webhookBase64 });
    if (!webhookApplied) console.warn("[whatsapp-connect] webhook/set did not apply");
    // The mark the round compares with: written only when the connection accepted this webhook. When it did not,
    // metadata below is rewritten without the old mark; for a business that is on, the next round applies it again.
    const webhookMark = webhookApplied ? { [WEBHOOK_BASE64_META]: webhookBase64 } : {};

    // A new code starts its own lifetime; refreshes are counted from zero.
    const qrMeta = qrCode ? { qrIssuedAt: Date.now(), qrRefreshes: 0 } : {};

    // Guardar en connected_apps. Only write accessToken when we actually have the instance token,
    // so a reconnect that could not read it never overwrites a good stored token with an empty string.
    await prisma.connectedApp.upsert({
      where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
      update: {
        ...(instanceToken ? { accessToken: instanceToken } : {}),
        waInstanceId: instanceName,
        waInstanceName: instanceName,
        waStatus: status,
        waQrCode: qrCode,
        waWebhookUrl: webhookUrl,
        connectedByUserId: userId,
        metadata: { instanceName, webhookUrl, ...qrMeta, ...webhookMark },
      },
      create: {
        tenantId,
        provider: "WHATSAPP",
        accessToken: instanceToken ?? "",
        waInstanceId: instanceName,
        waInstanceName: instanceName,
        waStatus: status,
        waQrCode: qrCode,
        waWebhookUrl: webhookUrl,
        connectedByUserId: userId,
        scopes: "WHATSAPP",
        metadata: { instanceName, webhookUrl, ...qrMeta, ...webhookMark },
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
