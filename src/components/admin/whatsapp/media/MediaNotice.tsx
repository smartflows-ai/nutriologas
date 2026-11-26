"use client";
// src/components/admin/whatsapp/media/MediaNotice.tsx
// Ticket #182: the line a chat bubble shows instead of a file (too large, limits, view once, no longer available,
// saving, failed) and the "removed by" line with Restore. Icon plus words, never color alone; it inherits the text
// color of the bubble, so it reads on the business's primary color and on the neutral side.
import { AlertCircle, Ban, EyeOff, FileWarning, FileX, HelpCircle, Loader2, RotateCcw, Timer, type LucideIcon } from "lucide-react";
import { useTranslation } from "@/i18n";
import { hiddenDateLabel, type MediaNoticeKey } from "./media-view";

const ICONS: Record<MediaNoticeKey, LucideIcon> = {
  saving: Loader2,
  tooLarge: FileWarning,
  sizeUnknown: HelpCircle,
  contactLimit: Ban,
  tenantLimit: Ban,
  platformLimit: Ban,
  failed: AlertCircle,
  unavailable: FileX,
  viewOnceImage: Timer,
  viewOnceVideo: Timer,
  viewOnceAudio: Timer,
};

export function MediaNotice({ notice }: { notice: MediaNoticeKey }) {
  const { t } = useTranslation();
  const Icon = ICONS[notice];
  return (
    <p className="flex items-start gap-1.5 text-xs leading-snug opacity-90" role="status">
      <Icon size={14} className={`mt-px shrink-0 ${notice === "saving" ? "animate-spin" : ""}`} aria-hidden="true" />
      <span>{t.crm.whatsapp.media[notice]}</span>
    </p>
  );
}

interface HiddenNoticeProps {
  hidden: { at: string; byName: string | null };
  busy: boolean;
  onRestore: () => void;
}

export function MediaHiddenNotice({ hidden, busy, onRestore }: HiddenNoticeProps) {
  const { t, lang } = useTranslation();
  const date = hiddenDateLabel(hidden.at, lang);
  const text = hidden.byName
    ? t.crm.whatsapp.media.hiddenBy.replace("{nombre}", hidden.byName).replace("{fecha}", date)
    : t.crm.whatsapp.media.hiddenNoName.replace("{fecha}", date);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="flex items-start gap-1.5 opacity-90">
        <EyeOff size={14} className="mt-px shrink-0" aria-hidden="true" />
        <span className="break-words">{text}</span>
      </span>
      <button
        type="button"
        onClick={onRestore}
        disabled={busy}
        className="inline-flex items-center gap-1 font-medium underline underline-offset-2 disabled:opacity-50"
      >
        <RotateCcw size={12} aria-hidden="true" />
        {t.crm.whatsapp.media.restore}
      </button>
    </div>
  );
}
