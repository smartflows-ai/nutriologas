// src/lib/wa-webhook-rev.ts
// Ticket #182 / #154 (plan v11): the WhatsApp webhook stops carrying the file (base64 false) only for the businesses
// that are on (WA_MEDIA_ENABLED_TENANTS), and the app applies it by itself in the 15-minute round: one short call per
// line, only when its mark (metadata.webhookBase64) differs from what the list wants. No disconnect, no QR, no script.
// - A line without a mark keeps the webhook it was created with (base64 true, the code's value until this change), so
//   a business that is off is never called. A business taken off the list gets the usual webhook back.
// - The address is the one stored on the line (the one it uses today). Without that address, the connection config or
//   the signing secret, the line is skipped with a short code: the connection replaces the whole webhook config, so
//   sending it without its headers would drop the signature.
// - The connection (2.3.7) saves the change but keeps `webhookBase64` in memory until the line connects again (found in
//   production on 2026-11-27: applied, yet the next photo still carried the file). So after the call the line is
//   restarted ONCE (the session is kept) and the mark is written only when it is "open" again within the wait: the mark
//   means "applied and reloaded". Never a restart loop: a line that does not come back is not marked, its try is kept
//   in metadata, and after MAX_RESTART_TRIES for the same change the round stops and reports it (a person looks at it).
//   The tries start again when the wanted value changes (the business leaves and comes back to the list).
// The pure part is tested with everything injected (tests/wa-webhook-rev.test.ts).
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  connectionState,
  evolutionConfigFromEnv,
  instanceKeyOf,
  restartInstance,
  setWebhook,
  webhookHeaders,
  type ConnectionStateValue,
} from "@/lib/messaging/evolution-adapter";
import { fitsInRun, type RunClock } from "@/lib/wa-media-purge";
import { mediaEnabledFor } from "@/lib/wa-media-data";

/** Key of the mark in connected_apps.metadata (no schema change): the base64 value last applied to the line. */
export const WEBHOOK_BASE64_META = "webhookBase64";
/** One webhook call never waits longer than this. */
export const WEBHOOK_SET_TIMEOUT_MS = 5_000;
/** Each read of the line's state. */
export const STATE_TIMEOUT_MS = 2_000;
/** The restart call never waits longer than this (measured: 84 ms). */
export const RESTART_TIMEOUT_MS = 5_000;
/** How long the line has to be "open" again after the restart (measured: under 3 s). */
export const RESTART_OPEN_TIMEOUT_MS = 15_000;
/** Pause between two reads of the state while waiting for "open". */
export const RESTART_POLL_MS = 1_500;
/** Restarts tried for one change before the round gives up on that line. */
export const MAX_RESTART_TRIES = 2;
/** Longest one line can take in the round: the call, the restart, the wait for "open" and the two state reads. */
export const WEBHOOK_SLOT_MS = WEBHOOK_SET_TIMEOUT_MS + RESTART_TIMEOUT_MS + RESTART_OPEN_TIMEOUT_MS + 2 * STATE_TIMEOUT_MS;
/** Keys of the restart tries in connected_apps.metadata: how many, and for which wanted value. */
export const WEBHOOK_RESTART_TRIES_META = "webhookRestartTries";
export const WEBHOOK_RESTART_FOR_META = "webhookRestartFor";

export type WebhookSkip =
  | "up_to_date"
  | "line_not_connected"
  | "no_connection_config"
  | "no_webhook_url"
  | "no_secret"
  | "restart_gave_up";
export type WebhookDecision = { action: "apply"; base64: boolean } | { action: "skip"; reason: WebhookSkip };

export interface WebhookInput {
  enabled: boolean;
  /** The mark of the line; null when it has none (lines created before this change). */
  stored: boolean | null;
  connected: boolean;
  hasConfig: boolean;
  hasUrl: boolean;
  hasSecret: boolean;
  /** Restarts already tried for the value the list wants now. */
  restartTries: number;
}

/** The base64 value a line without a mark has: the one the code used to create every line until this change. */
const LEGACY_BASE64 = true;

export function storedBase64Of(metadata: unknown): boolean | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[WEBHOOK_BASE64_META];
  return typeof value === "boolean" ? value : null;
}

/** The restart tries kept on the line, and the wanted value they were for. Anything malformed is no try. */
export function restartTriesOf(metadata: unknown): { tries: number; wantedFor: boolean | null } {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return { tries: 0, wantedFor: null };
  const raw = metadata as Record<string, unknown>;
  const tries = raw[WEBHOOK_RESTART_TRIES_META];
  const wantedFor = raw[WEBHOOK_RESTART_FOR_META];
  if (typeof tries !== "number" || !Number.isInteger(tries) || tries < 0 || typeof wantedFor !== "boolean") return { tries: 0, wantedFor: null };
  return { tries, wantedFor };
}

/** On: the file does not travel in the webhook (the app asks for it by key). Off: the usual webhook. */
export function wantedBase64(enabled: boolean): boolean {
  return !enabled;
}

export function decideWebhook(input: WebhookInput): WebhookDecision {
  const wanted = wantedBase64(input.enabled);
  if ((input.stored ?? LEGACY_BASE64) === wanted) return { action: "skip", reason: "up_to_date" };
  if (!input.connected) return { action: "skip", reason: "line_not_connected" };
  if (!input.hasConfig) return { action: "skip", reason: "no_connection_config" };
  if (!input.hasUrl) return { action: "skip", reason: "no_webhook_url" };
  if (!input.hasSecret) return { action: "skip", reason: "no_secret" };
  if (input.restartTries >= MAX_RESTART_TRIES) return { action: "skip", reason: "restart_gave_up" };
  return { action: "apply", base64: wanted };
}

export interface WebhookLine {
  tenantId: string;
  instance: string;
  apiKey: string;
  webhookUrl: string | null;
  connected: boolean;
  stored: boolean | null;
  /** Restart tries kept on the line, and the wanted value they were for (null: none). */
  restartTries: number;
  restartFor: boolean | null;
  metadata: Record<string, unknown>;
}

export interface WebhookDeps {
  listLines(): Promise<WebhookLine[]>;
  enabledFor(tenantId: string): boolean;
  hasConfig: boolean;
  /** The signing secret; null when this server has none. */
  secret: string | null;
  stateOf(line: WebhookLine): Promise<ConnectionStateValue | null>;
  setWebhook(line: WebhookLine, base64: boolean, headers: Record<string, string>): Promise<boolean>;
  /** Restarts the line's socket so it reloads the webhook (the session is kept). */
  restart(line: WebhookLine): Promise<boolean>;
  sleep(ms: number): Promise<void>;
  nowMs(): number;
  /** Writes the mark and clears the restart tries. */
  markApplied(line: WebhookLine, base64: boolean): Promise<void>;
  /** Keeps the number of restarts tried for this wanted value. */
  markTry(line: WebhookLine, wanted: boolean, tries: number): Promise<void>;
  /** Server log: business id, value, result and the line's state only (never the address, the key or the secret). */
  log(event: {
    tenantId: string;
    base64: boolean;
    applied: boolean;
    restarted: boolean;
    stateBefore: string | null;
    stateAfter: string | null;
  }): void;
}

export interface WebhookRunResult {
  applied: number;
  failed: number;
  skipped: Partial<Record<WebhookSkip, number>>;
  /** Lines to apply that did not fit in this run's time: untouched, they wait for the next run. */
  leftForNextRun: number;
  /**
   * Lines restarted that were NOT "open" again within RESTART_OPEN_TIMEOUT_MS: readable from the job's answer (the
   * workflow's run) without the hosting's logs. Each one is left unmarked, with its try recorded.
   */
  notOpenAfter: number;
}

type ApplyOutcome = "applied" | "failed" | "not_open_before" | "not_open_after";

/** Reads the state until "open" or the wait ends. Returns the last state read. */
async function waitForOpen(deps: WebhookDeps, line: WebhookLine): Promise<ConnectionStateValue | null> {
  const started = deps.nowMs();
  let state: ConnectionStateValue | null = null;
  while (deps.nowMs() - started < RESTART_OPEN_TIMEOUT_MS) {
    await deps.sleep(RESTART_POLL_MS);
    state = await deps.stateOf(line);
    if (state === "open") return state;
  }
  return state;
}

/** The tries of this line for the value wanted now: tries made for another value do not count. */
function triesFor(line: WebhookLine, wanted: boolean): number {
  return line.restartFor === wanted ? line.restartTries : 0;
}

async function applyOne(deps: WebhookDeps, line: WebhookLine, base64: boolean, headers: Record<string, string>): Promise<ApplyOutcome> {
  const stateBefore = await deps.stateOf(line);
  // The stored status can lag: a line that is not open right now is left for a later round.
  if (stateBefore !== "open") return "not_open_before";
  const applied = await deps.setWebhook(line, base64, headers);
  if (!applied) {
    deps.log({ tenantId: line.tenantId, base64, applied, restarted: false, stateBefore, stateAfter: null });
    return "failed";
  }
  // ONE restart, so the line reloads the webhook it keeps in memory. Never repeated in this run.
  const restarted = await deps.restart(line);
  const stateAfter = restarted ? await waitForOpen(deps, line) : null;
  deps.log({ tenantId: line.tenantId, base64, applied, restarted, stateBefore, stateAfter });
  if (restarted && stateAfter === "open") {
    await deps.markApplied(line, base64);
    return "applied";
  }
  await deps.markTry(line, base64, triesFor(line, base64) + 1);
  return restarted ? "not_open_after" : "failed";
}

function countSkip(result: WebhookRunResult, reason: WebhookSkip): void {
  result.skipped[reason] = (result.skipped[reason] ?? 0) + 1;
}

export async function reconcileWebhooks(deps: WebhookDeps, clock: RunClock): Promise<WebhookRunResult> {
  const result: WebhookRunResult = { applied: 0, failed: 0, skipped: {}, leftForNextRun: 0, notOpenAfter: 0 };
  const headers = webhookHeaders(deps.secret ?? undefined);
  for (const line of await deps.listLines()) {
    const decision = decideWebhook({
      enabled: deps.enabledFor(line.tenantId),
      stored: line.stored,
      connected: line.connected,
      hasConfig: deps.hasConfig,
      hasUrl: Boolean(line.webhookUrl),
      hasSecret: Boolean(headers.jwt_key),
      restartTries: triesFor(line, wantedBase64(deps.enabledFor(line.tenantId))),
    });
    if (decision.action === "skip") {
      countSkip(result, decision.reason);
      continue;
    }
    if (!fitsInRun(clock, WEBHOOK_SLOT_MS)) {
      result.leftForNextRun += 1;
      continue;
    }
    const outcome = await applyOne(deps, line, decision.base64, headers);
    if (outcome === "applied") result.applied += 1;
    else if (outcome === "failed") result.failed += 1;
    else if (outcome === "not_open_after") result.notOpenAfter += 1;
    else countSkip(result, "line_not_connected");
  }
  return result;
}

// ── Real dependencies ───────────────────────────────────────────────────────

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** The real dependencies of the round. Every WhatsApp line with an instance is read; only the ones to change are called. */
export function realWebhookDeps(): WebhookDeps {
  const cfg = evolutionConfigFromEnv();
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim() || null;
  return {
    async listLines() {
      if (!cfg) return [];
      const apps = await prisma.connectedApp.findMany({
        where: { provider: "WHATSAPP", waInstanceName: { not: null } },
        select: { tenantId: true, waInstanceName: true, accessToken: true, waStatus: true, waWebhookUrl: true, metadata: true },
      });
      return apps.map((app) => {
        const metadata = asObject(app.metadata);
        const restart = restartTriesOf(metadata);
        return {
          tenantId: app.tenantId,
          instance: app.waInstanceName as string,
          apiKey: instanceKeyOf(app.accessToken, cfg.globalKey),
          webhookUrl: app.waWebhookUrl?.trim() || null,
          connected: app.waStatus === "connected",
          stored: storedBase64Of(metadata),
          restartTries: restart.tries,
          restartFor: restart.wantedFor,
          metadata,
        };
      });
    },
    enabledFor: mediaEnabledFor,
    hasConfig: cfg !== null,
    secret,
    async stateOf(line) {
      if (!cfg) return null;
      return connectionState({ ...cfg, timeoutMs: STATE_TIMEOUT_MS }, { instance: line.instance, apiKey: line.apiKey });
    },
    async setWebhook(line, base64, headers) {
      if (!cfg || !line.webhookUrl) return false;
      return setWebhook({ ...cfg, timeoutMs: WEBHOOK_SET_TIMEOUT_MS }, { instance: line.instance, apiKey: line.apiKey, url: line.webhookUrl, headers, base64 });
    },
    async restart(line) {
      if (!cfg) return false;
      return restartInstance({ ...cfg, timeoutMs: RESTART_TIMEOUT_MS }, { instance: line.instance, apiKey: line.apiKey });
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    nowMs: () => Date.now(),
    async markApplied(line, base64) {
      // Read and written without a lock. The status route rewrites metadata only while a QR code is pending (a line
      // that is not connected), and connect/whatsapp only when the line connects, so a connected line's mark is not
      // lost in practice. If it were, the next round would apply and restart once more (one restart, measured safe).
      const { [WEBHOOK_RESTART_TRIES_META]: _tries, [WEBHOOK_RESTART_FOR_META]: _for, ...rest } = line.metadata;
      await prisma.connectedApp.update({
        where: { tenantId_provider: { tenantId: line.tenantId, provider: "WHATSAPP" } },
        data: { metadata: { ...rest, [WEBHOOK_BASE64_META]: base64 } as Prisma.InputJsonValue },
      });
    },
    async markTry(line, wanted, tries) {
      await prisma.connectedApp.update({
        where: { tenantId_provider: { tenantId: line.tenantId, provider: "WHATSAPP" } },
        data: { metadata: { ...line.metadata, [WEBHOOK_RESTART_TRIES_META]: tries, [WEBHOOK_RESTART_FOR_META]: wanted } as Prisma.InputJsonValue },
      });
    },
    log(event) {
      console.info("[wa-webhook] webhook change", event);
    },
  };
}
