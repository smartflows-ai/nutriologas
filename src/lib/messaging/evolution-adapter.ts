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

export type EvolutionResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number | null; error: EvolutionError };

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

export async function evolutionRequest<T = unknown>(
  cfg: EvolutionConfig,
  req: { path: string; apiKey: string; method?: "GET" | "POST" | "DELETE"; body?: unknown },
): Promise<EvolutionResult<T>> {
  const doFetch = cfg.fetchImpl ?? fetch;
  const headers: Record<string, string> = { apikey: req.apiKey };
  if (req.body !== undefined) headers["Content-Type"] = "application/json";
  try {
    const res = await doFetch(joinUrl(cfg.baseUrl, req.path), {
      method: req.method ?? "GET",
      headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      signal: AbortSignal.timeout(cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, status: res.status, error: "http" };
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
  const rawPhone = inst.ownerJid ?? inst.number ?? null;
  return {
    state: stateOf(inst.connectionStatus ?? inst.state),
    phone: rawPhone ? rawPhone.replace(/@.*$/, "").replace(/\D/g, "") || null : null,
    token: inst.token?.trim() || null,
  };
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
  return { enabled: true, url, headers, byEvents: false, base64: true, events: ["MESSAGES_UPSERT"] };
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
