// src/lib/wa-media-rules.ts
// Ticket #182: rules for the WhatsApp files the panel shows (plan .claude/plans/182-archivos-panel-whatsapp.plan.md,
// R1 to R9). Pure: no database, no network, no clock of its own. Every row and "now" are passed in, so the rules are
// tested without anything (tests/wa-media-rules.test.ts). The data layer runs the same rules as queries.
import { addClinicDays, clinicDateKeyOf, clinicDateTime } from "@/lib/clinic-time";
import { unwrapWaMessage } from "@/lib/wa-message-content";

// ── Limits (owner decisions of 2026-11-24 and 2026-11-25) ───────────────────

/** R2: a file larger than this is never downloaded. */
export const MAX_MEDIA_BYTES = 16 * 1024 * 1024;
/** R3: files received from one contact (one chat) per business day. */
export const MAX_MEDIA_PER_CONTACT_PER_DAY = 30;
/** R4 [v4]: bytes a business may hold in its private store, hidden files included (it was 2 GB). */
export const MAX_TENANT_MEDIA_BYTES = 1024 * 1024 * 1024;
/** R4 [v4]: bytes the whole platform may hold, unless the server setting WA_MEDIA_PLATFORM_MAX_BYTES says more. */
export const DEFAULT_PLATFORM_MEDIA_BYTES = 1024 * 1024 * 1024;
/** Download attempts before a file is given up as FAILED. */
export const MAX_MEDIA_ATTEMPTS = 5;
/** R5: days a copy lives; nothing moves this date. */
export const MEDIA_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const TWO_POW_32 = 2 ** 32;

// ── Types (they match the enums of prisma/sql/36-whatsapp-media) ────────────

export type MediaKind = "IMAGE" | "AUDIO" | "VIDEO" | "DOCUMENT" | "STICKER";

export type MediaStatus =
  | "RECEIVED"
  | "PENDING"
  | "STORED"
  | "TOO_LARGE"
  | "SIZE_UNKNOWN"
  | "CONTACT_LIMIT"
  | "TENANT_LIMIT"
  | "PLATFORM_LIMIT"
  | "VIEW_ONCE"
  | "FAILED"
  | "DESTROYED";

/** What a new file gets on arrival: PENDING means "download it"; anything else is the reason it is not. */
export type Admission = Extract<
  MediaStatus,
  "PENDING" | "VIEW_ONCE" | "SIZE_UNKNOWN" | "TOO_LARGE" | "CONTACT_LIMIT" | "TENANT_LIMIT" | "PLATFORM_LIMIT"
>;

export type DisplayMode = "image" | "audio" | "video" | "pdf-tab" | "download";

export interface MediaInfo {
  kind: MediaKind;
  viewOnce: boolean;
  /** Size the message declares, or null when it does not say (the patient branch of the workflow sends none). */
  declaredBytes: number | null;
  /** What the sender says the type is. Never used to decide what the panel shows (R9). */
  declaredMime: string | null;
  fileName: string | null;
  caption: string | null;
}

/** The fields of a file row these rules read. Sizes come as numbers (BIGINT is converted by the data layer). */
export interface MediaRow {
  chatId: string | null;
  fromMe: boolean;
  status: MediaStatus;
  sizeBytes: number | null;
  receivedAt: Date;
  destroyAfter: Date;
  destroyRequestedAt: Date | null;
  destroyedAt: Date | null;
  hiddenAt: Date | null;
}

// ── R1: what kind of file, from the shape of the message ────────────────────

const KIND_KEYS: ReadonlyArray<readonly [string, MediaKind]> = [
  ["imageMessage", "IMAGE"],
  ["videoMessage", "VIDEO"],
  ["ptvMessage", "VIDEO"],
  ["audioMessage", "AUDIO"],
  ["documentMessage", "DOCUMENT"],
  // An empty document-with-caption wrapper (no .message): the chat line says "[Documento]", so the kind agrees.
  ["documentWithCaptionMessage", "DOCUMENT"],
  ["stickerMessage", "STICKER"],
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Size in bytes from a WhatsApp `fileLength`: a number, a numeric text or a 64-bit long ({ low, high }).
 * Missing, zero, negative, fractional or non-numeric is null ("size unknown"), so the file is never downloaded.
 */
export function parseDeclaredBytes(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isSafeInteger(raw) && raw > 0 ? raw : null;
  if (typeof raw === "string") return /^\d+$/.test(raw) ? parseDeclaredBytes(Number(raw)) : null;
  const long = asRecord(raw);
  if (!long || !Number.isInteger(long.low) || !Number.isInteger(long.high)) return null;
  const low = long.low as number;
  const high = long.high as number;
  if (long.unsigned !== true && high < 0) return null;
  return parseDeclaredBytes((high >>> 0) * TWO_POW_32 + (low >>> 0));
}

/**
 * The file a message carries, or null when it carries none. A view-once file keeps neither caption nor name; an
 * empty view-once wrapper is a view-once photo, the same as its chat line ("[Foto de una sola vez]").
 */
export function mediaOf(message: unknown): MediaInfo | null {
  const { message: inner, viewOnce } = unwrapWaMessage(message);
  const found = KIND_KEYS.find(([key]) => asRecord(inner[key]));
  if (!found && !viewOnce) return null;
  const [key, kind]: readonly [string, MediaKind] = found ?? ["imageMessage", "IMAGE"];
  const part = asRecord(inner[key]) ?? {};
  return {
    kind,
    viewOnce,
    declaredBytes: parseDeclaredBytes(part.fileLength),
    declaredMime: textOrNull(part.mimetype),
    fileName: viewOnce ? null : textOrNull(part.fileName),
    caption: viewOnce ? null : textOrNull(part.caption),
  };
}

// ── R2, R3, R4, R7: what happens to a new file ──────────────────────────────

export interface AdmissionInput {
  viewOnce: boolean;
  declaredBytes: number | null;
  fromMe: boolean;
  /** Files of this contact already counted today (contactCountOn). */
  contactCountToday: number;
  /** Bytes the business holds now (tenantBytesInUse). */
  tenantBytesInUse: number;
  /** Bytes every business holds now, and the platform limit (platformMaxBytesOf). */
  platformBytesInUse: number;
  platformMaxBytes: number;
}

/** The platform limit from the server setting: a positive whole number of bytes, else 1 GB. Never "no limit". */
export function platformMaxBytesOf(raw: string | undefined): number {
  const text = raw?.trim() ?? "";
  if (!/^\d+$/.test(text)) return DEFAULT_PLATFORM_MEDIA_BYTES;
  const value = Number(text);
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_PLATFORM_MEDIA_BYTES;
}

/**
 * R2 to R4 and R7, in this order: view once, unknown size, too large, contact limit, business limit, platform limit.
 * The caller counts inside the same locked transaction that writes the verdict (wa-media-data.ts).
 */
export function admitMedia(input: AdmissionInput): Admission {
  if (input.viewOnce) return "VIEW_ONCE";
  const bytes = input.declaredBytes;
  if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) return "SIZE_UNKNOWN";
  if (bytes > MAX_MEDIA_BYTES) return "TOO_LARGE";
  if (!input.fromMe && input.contactCountToday >= MAX_MEDIA_PER_CONTACT_PER_DAY) return "CONTACT_LIMIT";
  if (input.tenantBytesInUse + bytes > MAX_TENANT_MEDIA_BYTES) return "TENANT_LIMIT";
  if (input.platformBytesInUse + bytes > input.platformMaxBytes) return "PLATFORM_LIMIT";
  return "PENDING";
}

/** R3 (owner, 2026-11-25): only files let in count; a file turned away, or not decided yet (RECEIVED), does not. */
export const CONTACT_COUNTED_STATUSES: readonly MediaStatus[] = ["PENDING", "STORED", "FAILED", "DESTROYED"];

export function countsTowardContactLimit(status: MediaStatus): boolean {
  return CONTACT_COUNTED_STATUSES.includes(status);
}

/** The business day that contains `now`, as instants: from its midnight to the next one, in the business zone. */
export function contactDayWindow(now: Date, zone: string): { start: Date; end: Date } {
  const day = clinicDateKeyOf(now, zone);
  return {
    start: new Date(clinicDateTime(day, "00:00", zone)),
    end: new Date(clinicDateTime(addClinicDays(day, 1), "00:00", zone)),
  };
}

/** R3: files received from this contact on the business day of `now`. Files the business sends never count. */
export function contactCountOn(rows: readonly MediaRow[], chatId: string, now: Date, zone: string): number {
  const { start, end } = contactDayWindow(now, zone);
  return rows.filter(
    (row) =>
      row.chatId === chatId &&
      !row.fromMe &&
      countsTowardContactLimit(row.status) &&
      row.receivedAt >= start &&
      row.receivedAt < end,
  ).length;
}

/** R4: statuses whose copy exists or is on its way. Hidden files still hold their place. */
export const TENANT_BYTE_STATUSES: readonly MediaStatus[] = ["PENDING", "STORED"];

export function tenantBytesInUse(rows: readonly MediaRow[]): number {
  return rows
    .filter((row) => TENANT_BYTE_STATUSES.includes(row.status))
    .reduce((sum, row) => sum + (row.sizeBytes ?? 0), 0);
}

// ── R5, R6: fixed destruction date, hide and restore ────────────────────────

export function destroyAfterOf(receivedAt: Date): Date {
  return new Date(receivedAt.getTime() + MEDIA_RETENTION_DAYS * DAY_MS);
}

/** Hiding records who and when; it never touches the destruction date. */
export function hidePatch(userId: string, at: Date): { hiddenAt: Date; hiddenById: string } {
  return { hiddenAt: at, hiddenById: userId };
}

export function restorePatch(): { hiddenAt: null; hiddenById: null } {
  return { hiddenAt: null, hiddenById: null };
}

/**
 * Due when not yet destroyed and: its date came, its chat was deleted (explicit mark), or the chat is gone (the
 * foreign key set it to null; the safety net if the mark was missed).
 */
export function isDueForDestruction(row: MediaRow, now: Date): boolean {
  if (row.destroyedAt) return false;
  return row.destroyRequestedAt !== null || row.chatId === null || now.getTime() >= row.destroyAfter.getTime();
}

/** Asking for destruction (the chat is deleted) removes the person's data from the row at once. */
export function destructionRequestPatch(at: Date): { destroyRequestedAt: Date; caption: null; fileName: null } {
  return { destroyRequestedAt: at, caption: null, fileName: null };
}

/**
 * Statuses whose file was sent to the store, so destruction asks the store to remove `<tenantId>/<id>` (removing a
 * missing copy is harmless). FAILED is here because an upload whose answer was lost (a timeout after the request
 * left) may have left a copy nobody knows about; it is not in TENANT_BYTE_STATUSES because it never counted as
 * stored, and it keeps its status after destruction.
 */
export const STORE_REMOVAL_STATUSES: readonly MediaStatus[] = ["PENDING", "STORED", "FAILED"];

export function needsStoreRemoval(status: MediaStatus): boolean {
  return STORE_REMOVAL_STATUSES.includes(status);
}

/**
 * After destruction the row keeps kind, size, dates and status. A pending or stored file becomes DESTROYED; any
 * other keeps the reason it was not stored (FAILED included).
 */
export function destroyedPatch(
  status: MediaStatus,
  at: Date,
): { status: MediaStatus; destroyedAt: Date; caption: null; fileName: null; storagePath: null } {
  return {
    status: TENANT_BYTE_STATUSES.includes(status) ? "DESTROYED" : status,
    destroyedAt: at,
    caption: null,
    fileName: null,
    storagePath: null,
  };
}

// ── Storage path: business first, ids only ──────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `<tenantId>/<mediaId>`. No file name and nothing of the sender: both ids must be UUIDs, or it throws. */
export function mediaStoragePath(tenantId: string, mediaId: string): string {
  if (!UUID.test(tenantId) || !UUID.test(mediaId)) throw new Error("invalid_media_path");
  return `${tenantId}/${mediaId}`;
}

export function isPathOfTenant(path: string, tenantId: string): boolean {
  if (!UUID.test(tenantId)) return false;
  const parts = path.split("/");
  return parts.length === 2 && parts[0] === tenantId && UUID.test(parts[1]);
}

// ── R9: the real type, and what the panel shows ─────────────────────────────

function startsWith(head: Uint8Array, bytes: readonly number[], offset = 0): boolean {
  return head.length >= offset + bytes.length && bytes.every((byte, i) => head[offset + i] === byte);
}

function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}

// MP4 family brands (ISO base media). Anything else with "ftyp" (HEIC photos, QuickTime) is not a known safe type.
const MP4_AUDIO_BRANDS = ["M4A ", "M4B "];
const MP4_VIDEO_BRANDS = ["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "M4V "];

/** The type read from the first bytes of the file, or null when it is not one of the known safe types. */
export function sniffMime(head: Uint8Array): string | null {
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(head, ascii("RIFF")) && startsWith(head, ascii("WEBP"), 8)) return "image/webp";
  if (startsWith(head, ascii("OggS"))) return "audio/ogg";
  if (startsWith(head, ascii("%PDF-"))) return "application/pdf";
  if (startsWith(head, ascii("ftyp"), 4)) {
    const brand = Array.from(head.slice(8, 12), (byte) => String.fromCharCode(byte)).join("");
    if (MP4_AUDIO_BRANDS.includes(brand)) return "audio/mp4";
    return MP4_VIDEO_BRANDS.includes(brand) ? "video/mp4" : null;
  }
  if (startsWith(head, ascii("ID3"))) return "audio/mpeg";
  if (head.length >= 2 && head[0] === 0xff && (head[1] & 0xf6) === 0xf0) return "audio/aac";
  if (head.length >= 2 && head[0] === 0xff && (head[1] & 0xe6) === 0xe2) return "audio/mpeg";
  return null;
}

/** R9: shown inside the chat only when the kind of message and the real type agree. A document is never shown. */
const INLINE_TYPES: Readonly<Record<MediaKind, readonly string[]>> = {
  IMAGE: ["image/jpeg", "image/png", "image/webp"],
  STICKER: ["image/webp", "image/png"],
  AUDIO: ["audio/ogg", "audio/mpeg", "audio/mp4", "audio/aac"],
  VIDEO: ["video/mp4"],
  DOCUMENT: [],
};

const INLINE_MODE: Readonly<Record<MediaKind, DisplayMode>> = {
  IMAGE: "image",
  STICKER: "image",
  AUDIO: "audio",
  VIDEO: "video",
  DOCUMENT: "download",
};

export function displayModeOf(kind: MediaKind, sniffedMime: string | null): DisplayMode {
  if (!sniffedMime) return "download";
  if (kind === "DOCUMENT") return sniffedMime === "application/pdf" ? "pdf-tab" : "download";
  return INLINE_TYPES[kind].includes(sniffedMime) ? INLINE_MODE[kind] : "download";
}

// ── Server switch: on per business ──────────────────────────────────────────

/** The switch lists the business ids that are on, separated by commas. Empty or missing is off for everyone. */
export function isMediaEnabledFor(tenantId: string, rawList: string | undefined): boolean {
  const id = tenantId.trim();
  if (!id || !rawList) return false;
  return rawList
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes(id);
}
