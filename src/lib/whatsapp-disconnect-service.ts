// src/lib/whatsapp-disconnect-service.ts
// Disconnects the tenant's WhatsApp line: removes its Evolution instance, then deletes the app row.
// Used by the server action (/admin/apps) and by DELETE /api/apps/[provider].
import { prisma } from "@/lib/db";
import { evolutionConfigFromEnv } from "@/lib/messaging/evolution-adapter";
import { removeWhatsAppInstance, shouldDeleteRecord } from "@/lib/whatsapp-disconnect";

export type DisconnectWhatsAppResult = { ok: true } | { ok: false; error: "evolution_unavailable" };

export async function disconnectWhatsAppLine(tenantId: string): Promise<DisconnectWhatsAppResult> {
  const rows = await prisma.connectedApp.findMany({
    where: { tenantId, provider: "WHATSAPP" },
    select: { id: true, waInstanceName: true, accessToken: true },
  });

  for (const row of rows) {
    if (!row.waInstanceName) continue; // nothing was created in Evolution for this row
    const cfg = evolutionConfigFromEnv();
    if (!cfg) return { ok: false, error: "evolution_unavailable" };

    const result = await removeWhatsAppInstance(cfg, {
      instance: row.waInstanceName,
      instanceToken: row.accessToken,
    });
    if (!shouldDeleteRecord(result.outcome)) {
      // Server log only: HTTP statuses and the error kind. The provider body and the instance name stay out.
      console.error("[whatsapp-disconnect] Evolution did not confirm the removal", {
        logoutStatus: result.logoutStatus,
        deleteStatus: result.deleteStatus ?? null,
        deleteError: result.deleteError ?? null,
      });
      return { ok: false, error: "evolution_unavailable" };
    }
  }

  await prisma.connectedApp.deleteMany({ where: { tenantId, provider: "WHATSAPP" } });
  return { ok: true };
}
