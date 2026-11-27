// src/lib/wa-media-access.ts
// Ticket #182, plan R8 and R9: whether a file gets a signed link and what the link says. Pure (tests in
// tests/wa-media-access.test.ts). The route loads the row scoped to the session's business; this checks the rest:
// - the stored path must be exactly <session business>/<id>: a path read from the database is never signed blindly;
// - only a stored copy that is not hidden, not destroyed and before its date gets a link;
// - the download name and the type the browser sees are set here, on the server, never taken from the browser.
import { displayModeOf, mediaStoragePath, type DisplayMode } from "@/lib/wa-media-rules";
import { contentDispositionFor, storedContentType, type SignedUrlOptions } from "@/lib/wa-media-storage";
import type { MediaForLink } from "@/lib/wa-media-data";

export type LinkDecision =
  | { ok: true; path: string; mode: DisplayMode; options: SignedUrlOptions }
  | { ok: false; error: "not_found" | "not_available" };

const GENERIC_BINARY = "application/octet-stream";

function expectedPath(tenantId: string, mediaId: string): string | null {
  try {
    return mediaStoragePath(tenantId, mediaId);
  } catch {
    return null;
  }
}

export function decideMediaLink(row: MediaForLink | null, sessionTenantId: string, now: Date, fallbackName: string): LinkDecision {
  if (!row) return { ok: false, error: "not_found" };
  const copyLives = row.status === "STORED" && !row.destroyedAt && row.destroyAfter.getTime() > now.getTime();
  if (!copyLives || row.hiddenAt || !row.storagePath) return { ok: false, error: "not_available" };
  const path = expectedPath(sessionTenantId, row.id);
  if (!path || row.storagePath !== path) return { ok: false, error: "not_found" };
  const mode = displayModeOf(row.kind, row.mimeType);
  if (mode === "image" || mode === "audio" || mode === "video") return { ok: true, path, mode, options: {} };
  return {
    ok: true,
    path,
    mode,
    options: {
      contentDisposition: contentDispositionFor(mode, row.fileName, fallbackName),
      contentType: mode === "pdf-tab" ? storedContentType(row.mimeType) : GENERIC_BINARY,
    },
  };
}

/** The name a download gets when the sender gave none, in the business language. */
export function fallbackDownloadName(language: string | null | undefined): string {
  return language === "en" ? "file" : "archivo";
}
