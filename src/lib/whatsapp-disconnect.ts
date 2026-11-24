// src/lib/whatsapp-disconnect.ts
// Removes the Evolution instance of a WhatsApp line when the business disconnects it.
// The app row is deleted only after Evolution confirms the instance is gone (see shouldDeleteRecord), so a
// failed call leaves the row in place and the business can retry instead of losing the instance's token.
// Each call reports its HTTP status or error kind, so a failure can be diagnosed from the server log.

import { type EvolutionConfig, deleteInstance, instanceKeyOf, logoutInstance } from "@/lib/messaging/evolution-adapter";
import type { EvolutionError } from "@/lib/messaging/evolution-adapter";

export type RemoveOutcome = "removed" | "already_gone" | "failed";

export interface RemoveInstanceResult {
  outcome: RemoveOutcome;
  /** HTTP status of the logout call; null when it never got an answer (timeout or network). */
  logoutStatus: number | null;
  /** HTTP status of the delete call; null when it never got an answer. */
  deleteStatus?: number | null;
  /** Kind of error from the delete call, when it did not succeed. */
  deleteError?: EvolutionError | null;
}

const NOT_FOUND = 404;

/**
 * Logs the session out (best effort: a failure does not stop the delete) and then deletes the instance.
 * `instanceToken` is the instance's own key; the global key is used for the delete.
 */
export async function removeWhatsAppInstance(
  cfg: EvolutionConfig,
  args: { instance: string; instanceToken: string | null | undefined },
): Promise<RemoveInstanceResult> {
  const logout = await logoutInstance(cfg, { instance: args.instance, apiKey: instanceKeyOf(args.instanceToken, cfg.globalKey) });
  const logoutStatus = logout.status;

  const res = await deleteInstance(cfg, { instance: args.instance });
  if (res.ok) return { outcome: "removed", logoutStatus, deleteStatus: res.status, deleteError: null };
  if (res.status === NOT_FOUND) return { outcome: "already_gone", logoutStatus, deleteStatus: res.status, deleteError: null };
  return { outcome: "failed", logoutStatus, deleteStatus: res.status, deleteError: res.error };
}

/** Only a confirmed removal lets the app delete its row (and with it the stored instance token). */
export function shouldDeleteRecord(outcome: RemoveOutcome): boolean {
  return outcome !== "failed";
}
