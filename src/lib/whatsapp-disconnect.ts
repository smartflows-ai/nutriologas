// src/lib/whatsapp-disconnect.ts
// The two Evolution steps of a WhatsApp disconnect. The steps are sequenced in whatsapp-disconnect-service.ts.
// Every call goes through the adapter (src/lib/messaging/evolution-adapter.ts), the only Evolution client.

import {
  type EvolutionConfig,
  type EvolutionError,
  deleteInstance,
  instanceKeyOf,
  instanceState,
  logoutInstance,
  shortDetail,
} from "@/lib/messaging/evolution-adapter";

const NOT_FOUND = 404;

/** Step 1: asks Evolution to close the session, with the instance's own token. It answers at once; the close can come later. */
export async function requestLogout(
  cfg: EvolutionConfig,
  args: { instance: string; instanceToken: string | null | undefined },
): Promise<{ logoutStatus: number | null }> {
  const logout = await logoutInstance(cfg, { instance: args.instance, apiKey: instanceKeyOf(args.instanceToken, cfg.globalKey) });
  return { logoutStatus: logout.status };
}

/**
 * True when Evolution answered the logout at all, even with an error (for example, "not connected": the session is
 * already closed). Null means no answer (timeout or network): the disconnect must not start.
 */
export function logoutReachedEvolution(logoutStatus: number | null): boolean {
  return logoutStatus !== null;
}

export type RemovalCheck =
  | { kind: "waiting" }
  | { kind: "removed" }
  | { kind: "failed"; deleteStatus: number | null; deleteError: EvolutionError | null; deleteDetail: string | null };

/**
 * Step 2, repeated by short checks: while the session is open, or its state cannot be read right now, it waits.
 * Once it is closed, or Evolution no longer has the instance, it deletes the instance with the global key.
 */
export async function removeIfClosed(cfg: EvolutionConfig, args: { instance: string }): Promise<RemovalCheck> {
  const { state, missing } = await instanceState(cfg, { instance: args.instance, apiKey: cfg.globalKey });
  if (!missing && state !== "close") return { kind: "waiting" };

  const res = await deleteInstance(cfg, { instance: args.instance });
  if (res.ok || res.status === NOT_FOUND) return { kind: "removed" };
  return { kind: "failed", deleteStatus: res.status, deleteError: res.error, deleteDetail: shortDetail(res.detail) };
}
