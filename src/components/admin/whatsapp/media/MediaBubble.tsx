"use client";
// src/components/admin/whatsapp/media/MediaBubble.tsx
// Ticket #182: the file part of a chat message. Chooses what to show from the file summary (media-view.ts): the photo,
// the audio or video player, the document card, the "removed by" line with Restore, or a notice. The link is asked
// only for a file that can be opened, and renewed before it expires (useMediaUrl). Owner and staff can hide a file.
import { useState } from "react";
import { EyeOff, Loader2, RotateCcw } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { MediaSummary } from "@/lib/wa-media-summary";
import { mediaViewOf } from "./media-view";
import { useMediaUrl } from "./useMediaUrl";
import { MediaDocument } from "./MediaDocument";
import { MediaImage } from "./MediaImage";
import { MediaHiddenNotice, MediaNotice } from "./MediaNotice";
import { useAppliedSrc } from "./useAppliedSrc";
import type { DisplayMode } from "@/lib/wa-media-rules";

interface Props {
  media: MediaSummary;
  /** Called after hide or restore, so the page reloads the messages. */
  onChanged: () => void;
}

function kindLabel(kind: MediaSummary["kind"], texts: { kindImage: string; kindAudio: string; kindVideo: string; kindDocument: string; kindSticker: string }): string {
  const labels = { IMAGE: texts.kindImage, AUDIO: texts.kindAudio, VIDEO: texts.kindVideo, DOCUMENT: texts.kindDocument, STICKER: texts.kindSticker };
  return labels[kind];
}

export function MediaBubble({ media, onChanged }: Props) {
  const { t } = useTranslation();
  const texts = t.crm.whatsapp.media;
  const view = mediaViewOf(media);
  const { state, reload } = useMediaUrl(media.id, view.kind === "content");
  const [busy, setBusy] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);

  const setHidden = async (hide: boolean) => {
    setBusy(true);
    setActionFailed(false);
    try {
      const res = await fetch(`/api/apps/whatsapp/media/${encodeURIComponent(media.id)}/${hide ? "hide" : "restore"}`, { method: "POST" });
      if (!res.ok) throw new Error("media_action_failed");
      onChanged();
    } catch {
      setActionFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (view.kind === "hidden") {
    return (
      <div className="mb-1 space-y-1">
        <MediaHiddenNotice hidden={view.hidden} busy={busy} onRestore={() => void setHidden(false)} />
        {actionFailed && <p className="text-xs opacity-90">{texts.actionError}</p>}
      </div>
    );
  }
  if (view.kind === "notice") return <div className="mb-1"><MediaNotice notice={view.notice} /></div>;

  const label = media.fileName || kindLabel(media.kind, texts);
  let body: JSX.Element;
  if (state.status === "loading") {
    body = (
      <p className="flex items-center gap-1.5 text-xs opacity-90" role="status">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        {texts.loading}
      </p>
    );
  } else if (state.status === "gone") {
    body = <MediaNotice notice="unavailable" />;
  } else if (state.status === "error") {
    body = (
      <p className="flex flex-wrap items-center gap-2 text-xs opacity-90">
        <span>{texts.linkError}</span>
        <button type="button" onClick={reload} className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
          <RotateCcw size={12} aria-hidden="true" />
          {texts.retry}
        </button>
      </p>
    );
  } else if (view.mode === "image" || view.mode === "audio" || view.mode === "video") {
    body = <MediaPlayer mode={view.mode} latest={state.url} label={label} reload={reload} />;
  } else {
    body = <MediaDocument url={state.url} fileName={media.fileName} sizeBytes={media.sizeBytes} opensInTab={view.mode === "pdf-tab"} />;
  }

  return (
    <div className="mb-1 space-y-1">
      {body}
      <button
        type="button"
        onClick={() => void setHidden(true)}
        disabled={busy}
        className="inline-flex items-center gap-1 text-xs opacity-75 underline-offset-2 hover:underline disabled:opacity-50"
      >
        <EyeOff size={12} aria-hidden="true" />
        {texts.hide}
      </button>
      {actionFailed && <p className="text-xs opacity-90">{texts.actionError}</p>}
    </div>
  );
}

interface PlayerProps {
  mode: Extract<DisplayMode, "image" | "audio" | "video">;
  latest: string;
  label: string;
  reload: () => void;
}

/** Photo, audio or video with the link applied by useAppliedSrc, so a renewal never cuts what is playing. */
function MediaPlayer({ mode, latest, label, reload }: PlayerProps) {
  const { src, onPlay, onPause, onError } = useAppliedSrc(mode, latest, reload);
  if (mode === "image") return <MediaImage url={src} label={label} onBroken={onError} />;
  const events = { onPlay, onPause, onEnded: onPause, onError };
  if (mode === "audio") return <audio controls preload="none" src={src} {...events} className="w-64 max-w-full" aria-label={label} />;
  return <video controls preload="metadata" src={src} {...events} className="max-h-72 max-w-full rounded-lg" aria-label={label} />;
}

