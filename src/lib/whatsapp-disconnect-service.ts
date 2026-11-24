// src/lib/whatsapp-disconnect-service.ts
// Disconnects the tenant's WhatsApp line in two short steps, so no request waits on Evolution for long:
//  1. startWhatsAppDisconnect: asks Evolution to close the session, marks the row "disconnecting" and returns.
//  2. checkWhatsAppDisconnect: called by the screen every few seconds. When Evolution reports the session closed,
//     it deletes the instance and then the app row. A failed delete keeps the row, marked "disconnect_failed".
// The mark lives in connected_apps.waStatus (no schema change). Used by the server actions and DELETE /api/apps/[provider].
import { prisma } from "@/lib/db";
import { evolutionConfigFromEnv } from "@/lib/messaging/evolution-adapter";
import { logoutReachedEvolution, removeIfClosed, requestLogout } from "@/lib/whatsapp-disconnect";
import { DISCONNECT_FAILED, DISCONNECTING } from "@/lib/whatsapp-disconnect-state";


export type DisconnectStart = { ok: true; status: "removed" | "disconnecting" } | { ok: false; error: "evolution_unavailable" };

export type DisconnectCheck =
  | { ok: true; status: "removed" | "disconnecting" | "idle" }
  | { ok: false; error: "evolution_unavailable" | "disconnect_failed" };

async function findLine(tenantId: string) {
  return prisma.connectedApp.findFirst({
    where: { tenantId, provider: "WHATSAPP" },
    select: { id: true, waInstanceName: true, accessToken: true, waStatus: true },
  });
}

/** Step 1. Sends the logout and returns at once. A line with no Evolution instance is removed right away. */
export async function startWhatsAppDisconnect(tenantId: string): Promise<DisconnectStart> {
  const line = await findLine(tenantId);
  if (!line) return { ok: true, status: "removed" };
  if (!line.waInstanceName) {
    await prisma.connectedApp.deleteMany({ where: { tenantId, provider: "WHATSAPP" } });
    return { ok: true, status: "removed" };
  }
  const cfg = evolutionConfigFromEnv();
  if (!cfg) return { ok: false, error: "evolution_unavailable" };

  const logout = await requestLogout(cfg, { instance: line.waInstanceName, instanceToken: line.accessToken });
  // No answer at all (timeout or network): do not start a disconnect that cannot be followed.
  if (!logoutReachedEvolution(logout.logoutStatus)) return { ok: false, error: "evolution_unavailable" };
  await prisma.connectedApp.updateMany({ where: { tenantId, provider: "WHATSAPP" }, data: { waStatus: DISCONNECTING } });
  return { ok: true, status: "disconnecting" };
}

/** Step 2. Called until it answers "removed" or "failed". Nothing is deleted before Evolution reports the session closed. */
export async function checkWhatsAppDisconnect(tenantId: string): Promise<DisconnectCheck> {
  const line = await findLine(tenantId);
  if (!line) return { ok: true, status: "removed" };
  if (line.waStatus !== DISCONNECTING && line.waStatus !== DISCONNECT_FAILED) return { ok: true, status: "idle" };
  if (!line.waInstanceName) {
    await prisma.connectedApp.deleteMany({ where: { tenantId, provider: "WHATSAPP" } });
    return { ok: true, status: "removed" };
  }
  const cfg = evolutionConfigFromEnv();
  if (!cfg) return { ok: false, error: "evolution_unavailable" };

  const result = await removeIfClosed(cfg, { instance: line.waInstanceName });
  if (result.kind === "waiting") return { ok: true, status: "disconnecting" };
  if (result.kind === "removed") {
    await prisma.connectedApp.deleteMany({ where: { tenantId, provider: "WHATSAPP" } });
    return { ok: true, status: "removed" };
  }
  // Server log only: HTTP status, error kind and Evolution's short message (digits masked). No instance name.
  console.error("[whatsapp-disconnect] Evolution did not confirm the removal", {
    deleteStatus: result.deleteStatus,
    deleteError: result.deleteError,
    deleteDetail: result.deleteDetail,
  });
  await prisma.connectedApp.updateMany({ where: { tenantId, provider: "WHATSAPP" }, data: { waStatus: DISCONNECT_FAILED } });
  return { ok: false, error: "disconnect_failed" };
}
