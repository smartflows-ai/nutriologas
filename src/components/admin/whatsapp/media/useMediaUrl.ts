"use client";
// src/components/admin/whatsapp/media/useMediaUrl.ts
// Ticket #182, plan R8: asks the server for a 5-minute link to one file and renews it before it expires, so a page
// left open keeps working. The browser only sends the file id; the server decides the name and the type.
import { useCallback, useEffect, useRef, useState } from "react";

/** Renew this long before the link expires. */
const RENEW_MARGIN_SECONDS = 30;
const MIN_RENEW_SECONDS = 15;

export type MediaUrlState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "gone" }
  | { status: "error" };

export function useMediaUrl(mediaId: string, enabled: boolean): { state: MediaUrlState; reload: () => void } {
  const [state, setState] = useState<MediaUrlState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/apps/whatsapp/media/${encodeURIComponent(mediaId)}`, { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 404 || res.status === 410) {
          setState({ status: "gone" });
          return;
        }
        if (!res.ok) {
          setState({ status: "error" });
          return;
        }
        const data = (await res.json()) as { url?: unknown; expiresIn?: unknown };
        if (cancelled || typeof data.url !== "string") return;
        setState({ status: "ready", url: data.url });
        const seconds = typeof data.expiresIn === "number" ? data.expiresIn : 300;
        timer.current = setTimeout(load, Math.max(MIN_RENEW_SECONDS, seconds - RENEW_MARGIN_SECONDS) * 1000);
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [mediaId, enabled, attempt]);

  return { state, reload };
}
