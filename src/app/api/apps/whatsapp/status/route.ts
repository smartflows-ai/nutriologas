// src/app/api/apps/whatsapp/status/route.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { MAX_QR_REFRESHES, QR_TTL_MS, fetchEvolutionQr, markQrExpired, qrMetaOf, storeQr } from "@/lib/whatsapp-qr";
import { connectionState, evolutionConfigFromEnv, fetchInstanceInfo, instanceKeyOf } from "@/lib/messaging/evolution-adapter";
import { readOwnerPhone } from "@/lib/whatsapp-phone";

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

  const cfg = evolutionConfigFromEnv();
  if (!cfg) return Response.json({ status: app.waStatus || "disconnected" });

  let isConnected = false;
  let phoneNumber: string | null = app.waPhoneNumber;
  const instanceKey = instanceKeyOf(app.accessToken, cfg.globalKey);

  // 1. Real state and owner phone from Evolution (server-side lookup with the global key).
  const info = await fetchInstanceInfo(cfg, app.waInstanceId);
  if (info?.state === "open") isConnected = true;
  if (info?.phone) phoneNumber = info.phone;
  // Open but no number yet: Evolution fills it a moment later, so read again a few times (about 2 seconds).
  if (info?.state === "open" && !phoneNumber && app.waInstanceId) {
    const instanceId = app.waInstanceId;
    phoneNumber = await readOwnerPhone(
      async () => (await fetchInstanceInfo(cfg, instanceId))?.phone ?? null,
      { tries: 3, wait: () => new Promise((resolve) => setTimeout(resolve, 1000)) },
    );
  }

  // 2. If that did not say open, ask the instance itself.
  if (!isConnected) {
    isConnected = (await connectionState(cfg, { instance: app.waInstanceId, apiKey: instanceKey })) === "open";
  }

  // Legacy row still holding the global key: replace it with the instance's own token.
  const tokenToStore = info?.token && info.token !== app.accessToken ? info.token : null;

  // 3. Pairing code still open: refresh it when it is older than its lifetime; after the last refresh it expires.
  let currentQr = app.waQrCode;
  let currentStatus = app.waStatus || "disconnected";
  if (!isConnected && app.waQrCode) {
    const meta = qrMetaOf(app.metadata);
    const refreshes = meta.qrRefreshes ?? 0;
    const stale = Date.now() - (meta.qrIssuedAt ?? 0) >= QR_TTL_MS;
    if (stale && refreshes >= MAX_QR_REFRESHES) {
      await markQrExpired(tenantId);
      currentQr = null;
      currentStatus = "qr_expired";
    } else if (stale) {
      const fresh = await fetchEvolutionQr(app.waInstanceId, app.accessToken);
      if (fresh) {
        await storeQr(tenantId, fresh, {
          ...((app.metadata as Record<string, unknown>) ?? {}),
          qrIssuedAt: Date.now(),
          qrRefreshes: refreshes + 1,
        });
        currentQr = fresh;
        currentStatus = "qr_pending";
      }
    }
  }

  // Si ya conectó, actualizar base de datos y limpiar QR
  if (isConnected) {
    if (app.waStatus !== "connected" || app.waQrCode !== null || (phoneNumber && !app.waPhoneNumber) || tokenToStore) {
      await prisma.connectedApp.update({
        where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
        data: {
          waStatus: "connected",
          waQrCode: null, // limpiar QR
          waPhoneNumber: phoneNumber || app.waPhoneNumber,
          ...(tokenToStore ? { accessToken: tokenToStore } : {}),
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
    status: currentStatus,
    qrCode: currentQr,
    phoneNumber: app.waPhoneNumber,
    instanceName: app.waInstanceId,
    webhookUrl: app.waWebhookUrl,
  });
}
