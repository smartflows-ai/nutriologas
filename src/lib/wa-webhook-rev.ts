// src/lib/wa-webhook-rev.ts
// Ticket #182 / #154 (plan v11): the WhatsApp webhook stops carrying the file (base64 false) only for the businesses
// that are on (WA_MEDIA_ENABLED_TENANTS), and the app applies it by itself in the 15-minute round: one short call per
// line, only when its mark (metadata.webhookBase64) differs from what the list wants. No disconnect, no QR, no script.
// - A line without a mark keeps the webhook it was created with (base64 true, the code's value until this change), so
//   a business that is off is never called. A business taken off the list gets the usual webhook back.
// - The address is the one stored on the line (the one it uses today). Without that address, the connection config or
//   the signing secret, the line is skipped with a short code: the connection replaces the whole webhook config, so
//   sending it without its headers would drop the signature.
// - The mark is written only after the connection accepted the change. A failure marks nothing: the next round retries.
// The pure part is tested with everything injected (tests/wa-webhook-rev.test.ts).
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  connectionState,
  evolutionConfigFromEnv,
  instanceKeyOf,
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
/** Each read of the line's state (before and after, the measurement of the first time). */
export const STATE_TIMEOUT_MS = 2_000;
/** Longest one line can take in the round. */
export const WEBHOOK_SLOT_MS = WEBHOOK_SET_TIMEOUT_MS + 2 * STATE_TIMEOUT_MS;

export type WebhookSkip = "up_to_date" | "line_not_connected" | "no_connection_config" | "no_webhook_url" | "no_secret";
export type WebhookDecision = { action: "apply"; base64: boolean } | { action: "skip"; reason: WebhookSkip };

export interface WebhookInput {
  enabled: boolean;
  /** The mark of the line; null when it has none (lines created before this change). */
  stored: boolean | null;
  connected: boolean;
  hasConfig: boolean;
  hasUrl: boolean;
  hasSecret: boolean;
}

/** The base64 value a line without a mark has: the one the code used to create every line until this change. */
const LEGACY_BASE64 = true;

export function storedBase64Of(metadata: unknown): boolean | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[WEBHOOK_BASE64_META];
  return typeof value === "boolean" ? value : null;
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
  return { action: "apply", base64: wanted };
}

export interface WebhookLine {
  tenantId: string;
  instance: string;
  apiKey: string;
  webhookUrl: string | null;
  connected: boolean;
  stored: boolean | null;
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
  markApplied(line: WebhookLine, base64: boolean): Promise<void>;
  /** Server log: business id, value, result and the line's state only (never the address, the key or the secret). */
  log(event: { tenantId: string; base64: boolean; applied: boolean; stateBefore: string | null; stateAfter: string | null }): void;
}

export interface WebhookRunResult {
  applied: number;
  failed: number;
  skipped: Partial<Record<WebhookSkip, number>>;
  /** Lines to apply that did not fit in this run's time: untouched, they wait for the next run. */
  leftForNextRun: number;
  /**
   * Lines applied that were NOT "open" right after: the measurement that a webhook change does not cut a line, readable
   * from the job's answer (the workflow's run) without the hosting's logs.
   */
  notOpenAfter: number;
}

type ApplyOutcome = "applied" | "failed" | "not_open_before";

async function applyOne(
  deps: WebhookDeps,
  line: WebhookLine,
  base64: boolean,
  headers: Record<string, string>,
  result: WebhookRunResult,
): Promise<ApplyOutcome> {
  const stateBefore = await deps.stateOf(line);
  // The stored status can lag: a line that is not open right now is left for a later round.
  if (stateBefore !== "open") return "not_open_before";
  const applied = await deps.setWebhook(line, base64, headers);
  const stateAfter = await deps.stateOf(line);
  deps.log({ tenantId: line.tenantId, base64, applied, stateBefore, stateAfter });
  if (!applied) return "failed";
  if (stateAfter !== "open") result.notOpenAfter += 1;
  await deps.markApplied(line, base64);
  return "applied";
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
    });
    if (decision.action === "skip") {
      countSkip(result, decision.reason);
      continue;
    }
    if (!fitsInRun(clock, WEBHOOK_SLOT_MS)) {
      result.leftForNextRun += 1;
      continue;
    }
    const outcome = await applyOne(deps, line, decision.base64, headers, result);
    if (outcome === "applied") result.applied += 1;
    else if (outcome === "failed") result.failed += 1;
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
        return {
          tenantId: app.tenantId,
          instance: app.waInstanceName as string,
          apiKey: instanceKeyOf(app.accessToken, cfg.globalKey),
          webhookUrl: app.waWebhookUrl?.trim() || null,
          connected: app.waStatus === "connected",
          stored: storedBase64Of(metadata),
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
    async markApplied(line, base64) {
      // Read and written without a lock: the status route can rewrite metadata at the same moment (it keeps what it
      // read). Losing the mark that way costs one repeated call in the next round; the call is idempotent.
      await prisma.connectedApp.update({
        where: { tenantId_provider: { tenantId: line.tenantId, provider: "WHATSAPP" } },
        data: { metadata: { ...line.metadata, [WEBHOOK_BASE64_META]: base64 } as Prisma.InputJsonValue },
      });
    },
    log(event) {
      console.info("[wa-webhook] webhook change", event);
    },
  };
}
