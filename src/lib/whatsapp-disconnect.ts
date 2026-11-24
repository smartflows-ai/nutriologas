// src/lib/whatsapp-disconnect.ts
// Removes the Evolution instance of a WhatsApp line when the business disconnects it.
// The app row is deleted only after Evolution confirms the instance is gone (see shouldDeleteRecord), so a
// failed call leaves the row in place and the business can retry instead of losing the instance's token.

import { type EvolutionConfig, deleteInstance, instanceKeyOf, logoutInstance } from "@/lib/messaging/evolution-adapter";

export type RemoveInstanceResult = "removed" | "already_gone" | "failed";

const NOT_FOUND = 404;

/**
 * Logs the session out (best effort: a failure does not stop the delete) and then deletes the instance.
 * `instanceToken` is the instance's own key; the global key is used for the delete.
 */
export async function removeWhatsAppInstance(
  cfg: EvolutionConfig,
  args: { instance: string; instanceToken: string | null | undefined },
): Promise<RemoveInstanceResult> {
  await logoutInstance(cfg, { instance: args.instance, apiKey: instanceKeyOf(args.instanceToken, cfg.globalKey) });

  const res = await deleteInstance(cfg, { instance: args.instance });
  if (res.ok) return "removed";
  if (res.status === NOT_FOUND) return "already_gone";
  return "failed";
}

/** Only a confirmed removal lets the app delete its row (and with it the stored instance token). */
export function shouldDeleteRecord(result: RemoveInstanceResult): boolean {
  return result !== "failed";
}
