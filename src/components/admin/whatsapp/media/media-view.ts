// src/components/admin/whatsapp/media/media-view.ts
// Ticket #182: what a chat bubble shows for a file, from its summary (plan R2 to R9). Pure, so it is tested without
// a browser (tests/wa-media-view.test.ts). The words come from t.crm.whatsapp.media.
import type { DisplayMode } from "@/lib/wa-media-rules";
import type { MediaSummary } from "@/lib/wa-media-summary";
import { isMediaMarker } from "@/lib/wa-message-content";

export type MediaNoticeKey =
  | "saving"
  | "tooLarge"
  | "sizeUnknown"
  | "contactLimit"
  | "tenantLimit"
  | "platformLimit"
  | "failed"
  | "unavailable"
  | "viewOnceImage"
  | "viewOnceVideo"
  | "viewOnceAudio";

export type MediaView =
  | { kind: "content"; mode: DisplayMode }
  | { kind: "hidden"; hidden: NonNullable<MediaSummary["hidden"]> }
  | { kind: "notice"; notice: MediaNoticeKey };

const NOTICE_BY_STATUS: Partial<Record<MediaSummary["status"], MediaNoticeKey>> = {
  RECEIVED: "saving",
  PENDING: "saving",
  TOO_LARGE: "tooLarge",
  SIZE_UNKNOWN: "sizeUnknown",
  CONTACT_LIMIT: "contactLimit",
  TENANT_LIMIT: "tenantLimit",
  PLATFORM_LIMIT: "platformLimit",
  FAILED: "failed",
};

function viewOnceNotice(kind: MediaSummary["kind"]): MediaNoticeKey {
  if (kind === "VIDEO") return "viewOnceVideo";
  if (kind === "AUDIO") return "viewOnceAudio";
  return "viewOnceImage";
}

export function mediaViewOf(media: MediaSummary): MediaView {
  if (media.hidden) return { kind: "hidden", hidden: media.hidden };
  if (media.available && media.displayMode) return { kind: "content", mode: media.displayMode };
  if (media.status === "VIEW_ONCE") return { kind: "notice", notice: viewOnceNotice(media.kind) };
  return { kind: "notice", notice: NOTICE_BY_STATUS[media.status] ?? "unavailable" };
}

const KB = 1024;
const MB = 1024 * 1024;

/** "2 KB", "1.5 MB"; null when the size is not known. */
export function sizeLabel(bytes: number | null, texts: { sizeKb: string; sizeMb: string }): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < MB) return texts.sizeKb.replace("{n}", String(Math.max(1, Math.round(bytes / KB))));
  const mb = Math.round((bytes / MB) * 10) / 10;
  return texts.sizeMb.replace("{n}", Number.isInteger(mb) ? String(mb) : mb.toFixed(1));
}

/**
 * The text shown with a message. With a file: its caption when there is one (a patient's caption reaches the file
 * row after the line was stored as "[Imagen]"), else the line only when it is not a marker; never the marker next to
 * the file. Without a file: the line as it is. Free text is returned as it came, with its line breaks.
 */
export function bubbleTextOf(content: string, media: MediaSummary | null): string | null {
  if (!media) return content;
  if (media.caption) return media.caption;
  return isMediaMarker(content) ? null : content;
}

export interface SrcState {
  /** An audio or video is playing right now. */
  playing: boolean;
  /** The element failed to load its current link. */
  errored: boolean;
}

/**
 * Which link an element uses when a renewed one arrives (plan R6 and R8): a renewal never interrupts. A playing audio
 * or video keeps its link until it is paused, ended or broken; a photo already shown keeps it unless it breaks;
 * documents always take the newest, because nothing is playing.
 */
export function nextMediaSrc(mode: DisplayMode, current: string | null, latest: string, state: SrcState): string {
  if (!current || state.errored) return latest;
  if (mode === "audio" || mode === "video") return state.playing ? current : latest;
  if (mode === "image") return current;
  return latest;
}

const DATE_LOCALE: Readonly<Record<string, string>> = { es: "es-MX", en: "en-US" };

/** "26 nov 2026" in a Spanish panel, "Nov 26, 2026" in an English one: the panel language, never the browser's. */
export function hiddenDateLabel(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(DATE_LOCALE[lang] ?? DATE_LOCALE.es, { day: "numeric", month: "short", year: "numeric" });
}
