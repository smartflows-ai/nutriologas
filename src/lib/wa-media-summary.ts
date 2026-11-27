// src/lib/wa-media-summary.ts
// Ticket #182: the summary of a file that each chat message carries (kind, status, name, size, how to show it),
// never a link. Pure (tests/wa-media-summary.test.ts); wa-media-data.ts loads the rows. A copy past its date reads
// as no longer available even before the 15-minute job destroys it, so the screen never has to guess.
import { displayModeOf, type DisplayMode, type MediaKind, type MediaStatus } from "@/lib/wa-media-rules";

export interface MediaSummary {
  id: string;
  messageId: string | null;
  kind: MediaKind;
  status: MediaStatus;
  fileName: string | null;
  caption: string | null;
  /** BIGINT in the database, a number here (Response.json cannot write a bigint). */
  sizeBytes: number | null;
  /** How the panel shows it once a link is asked; null when there is nothing to open. */
  displayMode: DisplayMode | null;
  /** True when a link can be asked now: stored, not hidden, not destroyed, before its date. */
  available: boolean;
  hidden: { at: string; byName: string | null } | null;
}

/** The columns summaryOf reads (wa-media-data.ts selects exactly these). */
export interface SummaryRow {
  id: string;
  messageId: string | null;
  kind: string;
  status: string;
  fileName: string | null;
  caption: string | null;
  sizeBytes: bigint | null;
  mimeType: string | null;
  destroyAfter: Date;
  destroyedAt: Date | null;
  hiddenAt: Date | null;
  hiddenBy: { name: string | null } | null;
}

export function summaryOf(row: SummaryRow, now: Date): MediaSummary {
  const kind = row.kind as MediaKind;
  const stored = row.status === "STORED";
  const copyLives = stored && !row.destroyedAt && row.destroyAfter.getTime() > now.getTime();
  return {
    id: row.id,
    messageId: row.messageId,
    kind,
    status: stored && !copyLives ? "DESTROYED" : (row.status as MediaStatus),
    fileName: row.fileName,
    caption: row.caption,
    sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
    displayMode: copyLives ? displayModeOf(kind, row.mimeType) : null,
    available: copyLives && !row.hiddenAt,
    hidden: row.hiddenAt && copyLives ? { at: row.hiddenAt.toISOString(), byName: row.hiddenBy?.name ?? null } : null,
  };
}
