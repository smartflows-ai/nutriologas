"use client";
// src/components/admin/whatsapp/media/useAppliedSrc.ts
// Ticket #182: the link an <img>, <audio> or <video> actually uses. A renewed link is kept aside and applied only
// when it does not interrupt anything (nextMediaSrc in media-view.ts): when the audio or video is paused or ended,
// or when the element breaks. A broken element with no newer link asks for one. The decision is made outside the
// state updater (React may run updaters twice in development), so a broken element asks for a link only once.
import { useCallback, useEffect, useRef, useState } from "react";
import type { DisplayMode } from "@/lib/wa-media-rules";
import { nextMediaSrc } from "./media-view";

export interface AppliedSrc {
  src: string;
  onPlay: () => void;
  onPause: () => void;
  onError: () => void;
}

export function useAppliedSrc(mode: DisplayMode, latest: string, reload: () => void): AppliedSrc {
  const [src, setSrc] = useState(latest);
  const applied = useRef(latest);
  const playing = useRef(false);
  const latestRef = useRef(latest);
  latestRef.current = latest;

  const apply = useCallback((errored: boolean) => {
    const next = nextMediaSrc(mode, applied.current, latestRef.current, { playing: playing.current, errored });
    applied.current = next;
    setSrc(next);
  }, [mode]);

  useEffect(() => {
    apply(false);
  }, [apply, latest]);

  const onPlay = useCallback(() => {
    playing.current = true;
  }, []);
  const onPause = useCallback(() => {
    playing.current = false;
    apply(false);
  }, [apply]);
  const onError = useCallback(() => {
    playing.current = false;
    if (applied.current === latestRef.current) reload();
    apply(true);
  }, [apply, reload]);

  return { src, onPlay, onPause, onError };
}
