// src/lib/wa-media-origin.ts
// Ticket #182: the real origin of a WhatsApp file. The line is always the one of the row's own business (its instance
// and its own key, read from its own connected_apps row), never a value from a request. Two reads only:
// - describe: the stored record of that exact message (same id and side) gives size, type, name, caption and view
//   once BEFORE anything is downloaded (mediaOf reads the full message; the workflow's trimmed shape is never used).
// - download: the file by its key alone (id, chat, side), as measured on 2026-11-26.
// Errors are short codes (timeout, network, http, no_line); nothing of the provider's answer is kept.
// The pure part (createMediaOrigin) is tested with the reads injected: tests/wa-media-origin.test.ts.
import { prisma } from "@/lib/db";
import {
  evolutionConfigFromEnv,
  findMessageByKey,
  instanceKeyOf,
  mediaByKey,
  type EvolutionConfig,
  type EvolutionResult,
  type MediaByKeyResult,
  type MessageKey,
} from "@/lib/messaging/evolution-adapter";
import { MAX_MEDIA_BYTES, mediaOf } from "@/lib/wa-media-rules";
import type { MediaOrigin, MediaRef, OriginError, OriginResult } from "@/lib/wa-media-ingest";
import { DESCRIBE_TIMEOUT_MS, DOWNLOAD_TIMEOUT_MS } from "@/lib/wa-media-purge";

/**
 * Longest answer read for one file: the base64 of a 16 MB file plus 64 KB for the rest of the JSON. A longer answer
 * means the declared size lied; it is refused before reading it (the row ends TOO_LARGE).
 */
export const MAX_MEDIA_RESPONSE_BYTES = Math.ceil(MAX_MEDIA_BYTES / 3) * 4 + 64 * 1024;

/** The WhatsApp line of one business: its instance and the key for calls about it. */
export interface OriginLine {
  instance: string;
  apiKey: string;
}

type JsonRecord = Record<string, unknown>;

export interface OriginDeps {
  /** The line of this business, or null when it has none connected. */
  lineOf(tenantId: string): Promise<OriginLine | null>;
  findByKey(line: OriginLine, keyId: string, signal?: AbortSignal): Promise<EvolutionResult<JsonRecord[]>>;
  fileByKey(line: OriginLine, key: MessageKey, signal?: AbortSignal): Promise<MediaByKeyResult>;
}

const NO_LINE = { ok: false, error: "no_line" } as const;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

/** The record of exactly this message: same id and same side. Any other record is ignored. */
function recordOf(records: JsonRecord[], ref: MediaRef): JsonRecord | null {
  return (
    records.find((record) => {
      const key = asRecord(record.key);
      return key?.id === ref.keyId && Boolean(key.fromMe) === ref.fromMe;
    }) ?? null
  );
}

function failure<T>(error: OriginError): OriginResult<T> {
  return { ok: false, error };
}

export function createMediaOrigin(deps: OriginDeps): MediaOrigin {
  // One lookup per business for the life of this origin (one sync request, or one 15-minute run).
  const lines = new Map<string, Promise<OriginLine | null>>();
  const lineFor = (tenantId: string) => {
    const known = lines.get(tenantId);
    if (known) return known;
    const pending = deps.lineOf(tenantId);
    lines.set(tenantId, pending);
    return pending;
  };
  return {
    async describe(ref, signal) {
      const line = await lineFor(ref.tenantId);
      if (!line) return NO_LINE;
      const found = await deps.findByKey(line, ref.keyId, signal);
      if (!found.ok) return failure(found.error);
      const record = recordOf(found.data, ref);
      return { ok: true, value: record ? mediaOf(record.message) : null };
    },
    async download(ref, signal) {
      const line = await lineFor(ref.tenantId);
      if (!line) return NO_LINE;
      const file = await deps.fileByKey(line, { id: ref.keyId, remoteJid: ref.remoteJid, fromMe: ref.fromMe }, signal);
      return file.ok ? { ok: true, value: file.data } : failure(file.error);
    },
  };
}

/** The connected line of one business, read from its own row. Null when it has none (or it is not connected). */
async function lineOfTenant(cfg: EvolutionConfig, tenantId: string): Promise<OriginLine | null> {
  const app = await prisma.connectedApp.findUnique({
    where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
    select: { waInstanceName: true, accessToken: true, waStatus: true },
  });
  if (!app?.waInstanceName || app.waStatus !== "connected") return null;
  return { instance: app.waInstanceName, apiKey: instanceKeyOf(app.accessToken, cfg.globalKey) };
}

/** The real origin, or null when the WhatsApp connection is not configured on this server (nothing is fetched). */
export function serverMediaOrigin(): MediaOrigin | null {
  const cfg = evolutionConfigFromEnv();
  if (!cfg) return null;
  return createMediaOrigin({
    lineOf: (tenantId) => lineOfTenant(cfg, tenantId),
    findByKey: (line, keyId, signal) =>
      findMessageByKey({ ...cfg, timeoutMs: DESCRIBE_TIMEOUT_MS }, { instance: line.instance, apiKey: line.apiKey, keyId, signal }),
    fileByKey: (line, key, signal) =>
      mediaByKey(
        { ...cfg, timeoutMs: DOWNLOAD_TIMEOUT_MS },
        { instance: line.instance, apiKey: line.apiKey, key, signal, maxResponseBytes: MAX_MEDIA_RESPONSE_BYTES },
      ),
  });
}
