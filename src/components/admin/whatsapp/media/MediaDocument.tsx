"use client";
// src/components/admin/whatsapp/media/MediaDocument.tsx
// Ticket #182, plan R9: a document is never drawn inside the chat. It shows its full name (wrapped, never cut) and
// its size, and offers a download; a PDF opens in a new tab instead (the browser's viewer saves it with its name).
// The name is shown as text, never as HTML.
import { Download, ExternalLink, FileText } from "lucide-react";
import { useTranslation } from "@/i18n";
import { sizeLabel } from "./media-view";

interface Props {
  url: string;
  fileName: string | null;
  sizeBytes: number | null;
  opensInTab: boolean;
}

export function MediaDocument({ url, fileName, sizeBytes, opensInTab }: Props) {
  const { t } = useTranslation();
  const texts = t.crm.whatsapp.media;
  const size = sizeLabel(sizeBytes, texts);
  return (
    <div className="flex items-start gap-2 rounded-lg border border-black/10 p-2 dark:border-white/15">
      <FileText size={20} className="mt-0.5 shrink-0 opacity-80" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium">{fileName || texts.kindDocument}</p>
        {size && <p className="text-xs opacity-75">{size}</p>}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium">
          {opensInTab ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
              <ExternalLink size={12} aria-hidden="true" />
              {texts.openPdf}
            </a>
          ) : (
            <a href={url} rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
              <Download size={12} aria-hidden="true" />
              {texts.download}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
