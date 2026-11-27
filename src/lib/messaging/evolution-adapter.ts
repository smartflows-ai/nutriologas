// src/lib/messaging/evolution-adapter.ts
// The only code that talks to Evolution API (the current WhatsApp provider).
// - TLS is always validated (no custom agent) and every call has a timeout.
// - Calls about one instance use that instance's own token; the global key is used only for create and
//   fetchInstances, and is never stored in the database.
// - Errors carry the HTTP status only: provider bodies can echo phone numbers or message text, so they are
//   neither returned nor logged.
// Fetch is injected so the module is tested without network (tests/evolution-adapter.test.ts).

export interface EvolutionConfig {
  baseUrl: string;
  globalKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export type EvolutionError = "timeout" | "network" | "http";

/** The detail of an answer refused without reading it: it declared a body over the caller's limit. */
const BODY_OVER_LIMIT = "body over limit";

export type EvolutionResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number | null; error: EvolutionError; detail?: string | null };

/**
 * Only the short `message` text of an error answer, for the server log. Nothing else of the body leaves
 * this module: the body can echo a phone number or message text, so it is never returned as a whole.
 */
const DETAIL_MAX = 120;

/** Cuts the text to 120 characters and masks any run of 6 or more digits (phone numbers). */
export function shortDetail(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.replace(/\d{6,}/g, "***").slice(0, DETAIL_MAX);
}

/** The text of a message field: a string, or a list of strings joined. */
function messageText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) return value.join(" | ");
  return null;
}

/**
 * When the body has no readable message, only its shape: each top-level key with its JSON type, never a value.
 * It tells a support engineer the answer's structure without repeating anything the provider wrote.
 */
function bodyShape(parsed: unknown): string {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return `shape: ${Array.isArray(parsed) ? "array" : typeof parsed}`;
  const parts = Object.entries(parsed as Record<string, unknown>).map(([key, value]) => {
    const type = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
    return `${key}:${type}`;
  });
  return `shape: ${parts.join(", ") || "empty"}`;
}

async function shortProviderMessage(res: Response): Promise<string | null> {
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return `shape: not json, ${text.length} characters`;
  }
  const body = parsed as { message?: unknown; response?: { message?: unknown } };
  const message = messageText(body.response?.message) ?? messageText(body.message);
  return shortDetail(message ?? bodyShape(parsed));
}

export type ConnectionStateValue = "open" | "connecting" | "close";

const DEFAULT_TIMEOUT_MS = 15_000;

// Typing indicator shown before a message: grows with the text, with random jitter.
const TYPING_MIN_MS = 1_500;
const TYPING_MAX_MS = 8_000;
const TYPING_MS_PER_CHAR = 25;
const TYPING_JITTER_MS = 1_500;

export function evolutionConfigFromEnv(): EvolutionConfig | null {
  const baseUrl = process.env.EVOLUTION_API_URL?.trim();
  const globalKey = process.env.EVOLUTION_API_KEY?.trim();
  if (!baseUrl || !globalKey) return null;
  return { baseUrl, globalKey };
}

/** The key for calls about one instance: its own token when stored, the global key for legacy rows. */
export function instanceKeyOf(storedToken: string | null | undefined, globalKey: string): string {
  const token = storedToken?.trim();
  return token ? token : globalKey;
}

/**
 * Headers Evolution sends with every webhook. With `jwt_key`, Evolution signs each call with a short-lived
 * JWT (HS256, 10 minutes) in `Authorization: Bearer ...`; the n8n webhook verifies it (JWT Auth).
 */
export function webhookHeaders(secret: string | undefined): Record<string, string> {
  const value = secret?.trim();
  return value ? { jwt_key: value } : {};
}

export function typingDelayMs(text: string, random: () => number = Math.random): number {
  const base = TYPING_MIN_MS + text.length * TYPING_MS_PER_CHAR;
  const withJitter = base + Math.floor(random() * TYPING_JITTER_MS);
  return Math.min(TYPING_MAX_MS, withJitter);
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function seg(value: string): string {
  return encodeURIComponent(value);
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

/** The adapter's own timeout, plus the caller's deadline when there is one: whichever comes first aborts the call. */
function requestSignal(timeoutMs: number, callerSignal: AbortSignal | undefined): AbortSignal {
  const own = AbortSignal.timeout(timeoutMs);
  return callerSignal ? AbortSignal.any([own, callerSignal]) : own;
}

/** True when the answer says (Content-Length) it is longer than the limit. Without that header the body is read. */
function declaresMoreThan(res: Response, maxBodyBytes: number | undefined): boolean {
  if (maxBodyBytes === undefined) return false;
  const declared = Number(res.headers.get("content-length"));
  return Number.isFinite(declared) && declared > maxBodyBytes;
}

export async function evolutionRequest<T = unknown>(
  cfg: EvolutionConfig,
  req: { path: string; apiKey: string; method?: "GET" | "POST" | "DELETE"; body?: unknown; signal?: AbortSignal; maxBodyBytes?: number },
): Promise<EvolutionResult<T>> {
  const doFetch = cfg.fetchImpl ?? fetch;
  const headers: Record<string, string> = { apikey: req.apiKey };
  if (req.body !== undefined) headers["Content-Type"] = "application/json";
  try {
    const res = await doFetch(joinUrl(cfg.baseUrl, req.path), {
      method: req.method ?? "GET",
      headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      signal: requestSignal(cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS, req.signal),
    });
    if (!res.ok) return { ok: false, status: res.status, error: "http", detail: await shortProviderMessage(res) };
    if (declaresMoreThan(res, req.maxBodyBytes)) {
      await res.body?.cancel().catch(() => undefined);
      return { ok: false, status: res.status, error: "http", detail: BODY_OVER_LIMIT };
    }
    const text = await res.text();
    const data = (text ? JSON.parse(text) : {}) as T;
    return { ok: true, status: res.status, data };
  } catch (error: unknown) {
    return { ok: false, status: null, error: isTimeout(error) ? "timeout" : "network" };
  }
}

// ── Messages ────────────────────────────────────────────────────────────────

export type SendTextResult =
  | { ok: true; messageId: string | null; data: unknown }
  | { ok: false; status: number | null; error: EvolutionError };

export async function sendText(
  cfg: EvolutionConfig,
  args: { instance: string; apiKey: string; number: string; text: string; delayMs?: number },
): Promise<SendTextResult> {
  const body: Record<string, unknown> = { number: args.number, text: args.text };
  if (args.delayMs !== undefined) body.delay = args.delayMs;
  const res = await evolutionRequest<{ key?: { id?: string } }>(cfg, {
    path: `/message/sendText/${seg(args.instance)}`,
    method: "POST",
    apiKey: args.apiKey,
    body,
  });
  if (!res.ok) return res;
  return { ok: true, messageId: res.data?.key?.id ?? null, data: res.data };
}

// ── Files of received messages (#182): read by message key, never carried in the webhook ──

/** The fields of a message key the connection needs to find a message and its file. */
export interface MessageKey {
  id: string;
  remoteJid: string;
  fromMe: boolean;
}

type JsonRecord = Record<string, unknown>;

/**
 * Records asked per lookup. In 2.3.7 `offset` is the page size (`take`, newest first; channel.service.ts fetchMessages,
 * read on 2026-11-27). A small page instead of one record, so the caller picks the record of the same id and side if
 * the connection keeps more than one with that id.
 */
const FIND_PAGE_SIZE = 10;

/**
 * The stored records of ONE message, by its id, on one instance (empty when the connection has no such message).
 * Read only. The record carries the full message: size (fileLength), type, file name, caption and view once.
 */
export async function findMessageByKey(
  cfg: EvolutionConfig,
  args: { instance: string; apiKey: string; keyId: string; signal?: AbortSignal },
): Promise<EvolutionResult<JsonRecord[]>> {
  const res = await evolutionRequest<{ messages?: { records?: unknown } }>(cfg, {
    path: `/chat/findMessages/${seg(args.instance)}`,
    method: "POST",
    apiKey: args.apiKey,
    body: { where: { key: { id: args.keyId } }, offset: FIND_PAGE_SIZE, page: 1 },
    signal: args.signal,
  });
  if (!res.ok) return res;
  const records = res.data?.messages?.records;
  const list = Array.isArray(records) ? records.filter((r): r is JsonRecord => !!r && typeof r === "object") : [];
  return { ok: true, status: res.status, data: list };
}

/**
 * The bytes of the file of one message, asked by its key alone (measured on 2026-11-26: a 2.1 MB video in 871 ms).
 * Read only. An answer without bytes is an error, never an empty file.
 */
/** Like any read, plus "too_large": the answer declared more than `maxResponseBytes` and was never read. */
export type MediaByKeyResult = EvolutionResult<Uint8Array> | { ok: false; status: number | null; error: "too_large" };

export async function mediaByKey(
  cfg: EvolutionConfig,
  args: { instance: string; apiKey: string; key: MessageKey; signal?: AbortSignal; maxResponseBytes?: number },
): Promise<MediaByKeyResult> {
  const res = await evolutionRequest<{ base64?: unknown }>(cfg, {
    path: `/chat/getBase64FromMediaMessage/${seg(args.instance)}`,
    method: "POST",
    apiKey: args.apiKey,
    body: { message: { key: { id: args.key.id, remoteJid: args.key.remoteJid, fromMe: args.key.fromMe } }, convertToMp4: false },
    signal: args.signal,
    maxBodyBytes: args.maxResponseBytes,
  });
  if (!res.ok && res.detail === BODY_OVER_LIMIT) return { ok: false, status: res.status, error: "too_large" };
  if (!res.ok) return res;
  const base64 = typeof res.data?.base64 === "string" ? res.data.base64 : "";
  if (!base64) return { ok: false, status: res.status, error: "http", detail: "no file in the answer" };
  return { ok: true, status: res.status, data: new Uint8Array(Buffer.from(base64, "base64")) };
}

// ── Connection ──────────────────────────────────────────────────────────────

function stateOf(value: unknown): ConnectionStateValue | null {
  return value === "open" || value === "connecting" || value === "close" ? value : null;
}

export async function connectionState(
  cfg: EvolutionConfig,
  args: { instance: string; apiKey: string },
): Promise<ConnectionStateValue | null> {
  const res = await evolutionRequest<{ instance?: { state?: string }; state?: string; connectionStatus?: string }>(cfg, {
    path: `/instance/connectionState/${seg(args.instance)}`,
    apiKey: args.apiKey,
  });
  if (!res.ok) return null;
  return stateOf(res.data?.instance?.state ?? res.data?.state ?? res.data?.connectionStatus);
}

/** Connection state plus whether Evolution no longer has the instance (404). */
export async function instanceState(
  cfg: EvolutionConfig,
  args: { instance: string; apiKey: string },
): Promise<{ state: ConnectionStateValue | null; missing: boolean }> {
  const res = await evolutionRequest<{ instance?: { state?: string }; state?: string }>(cfg, {
    path: `/instance/connectionState/${seg(args.instance)}`,
    apiKey: args.apiKey,
  });
  if (res.ok) return { state: stateOf(res.data?.instance?.state ?? res.data?.state), missing: false };
  return { state: null, missing: res.status === 404 };
}

export interface InstanceInfo {
  state: ConnectionStateValue | null;
  phone: string | null;
  token: string | null;
}

interface RawInstance {
  name?: string;
  id?: string;
  connectionStatus?: string;
  state?: string;
  ownerJid?: string;
  number?: string;
  token?: string;
  /** Older Evolution answers nest the instance data. */
  instance?: { ownerJid?: string; number?: string };
}

/** Server-only lookup with the global key: state, owner phone and the instance's own token. */
export async function fetchInstanceInfo(cfg: EvolutionConfig, instance: string): Promise<InstanceInfo | null> {
  const res = await evolutionRequest<RawInstance[] | RawInstance>(cfg, {
    path: `/instance/fetchInstances?instanceName=${seg(instance)}`,
    apiKey: cfg.globalKey,
  });
  if (!res.ok) return null;
  const list = Array.isArray(res.data) ? res.data : [res.data];
  const inst = list.find((i) => i?.name === instance || i?.id === instance);
  if (!inst) return null;
  // Only the matched instance is read: never another one from the list (it may belong to another business).
  const rawPhone = inst.ownerJid ?? inst.number ?? inst.instance?.ownerJid ?? inst.instance?.number ?? null;
  return {
    state: stateOf(inst.connectionStatus ?? inst.state),
    phone: rawPhone ? rawPhone.replace(/@.*$/, "").replace(/\D/g, "") || null : null,
    token: inst.token?.trim() || null,
  };
}

/** Ends the WhatsApp session of one instance (the instance token is used). Evolution: DELETE /instance/logout. */
export async function logoutInstance(
  cfg: EvolutionConfig,
  args: { instance: string; apiKey: string },
): Promise<EvolutionResult<unknown>> {
  return evolutionRequest(cfg, {
    path: `/instance/logout/${seg(args.instance)}`,
    method: "DELETE",
    apiKey: args.apiKey,
  });
}

/**
 * Removes the instance itself. Server-only, with the global key (the same key that creates instances).
 * Evolution: DELETE /instance/delete. A 404 means the instance is already gone.
 */
export async function deleteInstance(
  cfg: EvolutionConfig,
  args: { instance: string },
): Promise<EvolutionResult<unknown>> {
  return evolutionRequest(cfg, {
    path: `/instance/delete/${seg(args.instance)}`,
    method: "DELETE",
    apiKey: cfg.globalKey,
  });
}

/** Current pairing code. null when the instance is already open or no code is ready yet. */
export async function connectQr(cfg: EvolutionConfig, args: { instance: string; apiKey: string }): Promise<string | null> {
  const res = await evolutionRequest<{ base64?: string; code?: string }>(cfg, {
    path: `/instance/connect/${seg(args.instance)}`,
    apiKey: args.apiKey,
  });
  if (!res.ok) return null;
  return res.data?.base64 || res.data?.code || null;
}

// ── Instance setup ──────────────────────────────────────────────────────────

const INSTANCE_SETTINGS = {
  rejectCall: true,
  groupsIgnore: true,
  alwaysOnline: true,
  readMessages: true,
  readStatus: false,
  syncFullHistory: false,
} as const;

function webhookConfig(url: string, headers: Record<string, string>) {
  return { enabled: true, url, headers, byEvents: false, base64: true, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] };
}

export type CreateInstanceResult =
  | { ok: true; token: string | null; qrCode: string | null; alreadyExists: false }
  | { ok: false; status: number | null; error: EvolutionError };

export async function createInstance(
  cfg: EvolutionConfig,
  args: { instance: string; webhookUrl: string; headers: Record<string, string> },
): Promise<CreateInstanceResult> {
  const res = await evolutionRequest<{ hash?: string | { apikey?: string }; qrcode?: { base64?: string } }>(cfg, {
    path: "/instance/create",
    method: "POST",
    apiKey: cfg.globalKey,
    body: {
      instanceName: args.instance,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      ...INSTANCE_SETTINGS,
      webhook: webhookConfig(args.webhookUrl, args.headers),
    },
  });
  if (!res.ok) return res;
  const hash = res.data?.hash;
  const token = typeof hash === "string" ? hash : hash?.apikey ?? null;
  return { ok: true, token: token || null, qrCode: res.data?.qrcode?.base64 ?? null, alreadyExists: false };
}

export async function setSettings(cfg: EvolutionConfig, args: { instance: string; apiKey: string }): Promise<boolean> {
  const res = await evolutionRequest(cfg, {
    path: `/settings/set/${seg(args.instance)}`,
    method: "POST",
    apiKey: args.apiKey,
    body: INSTANCE_SETTINGS,
  });
  return res.ok;
}

export async function setWebhook(
  cfg: EvolutionConfig,
  args: { instance: string; apiKey: string; url: string; headers: Record<string, string> },
): Promise<boolean> {
  const res = await evolutionRequest(cfg, {
    path: `/webhook/set/${seg(args.instance)}`,
    method: "POST",
    apiKey: args.apiKey,
    body: { webhook: webhookConfig(args.url, args.headers) },
  });
  return res.ok;
}
