"use client";
// src/components/admin/whatsapp/media/MediaImage.tsx
// Ticket #182: a photo or sticker inside the chat, with a full view on click. The full view is portaled to the
// body, so it declares the business's font (ui-tenant rule). Escape, the close button or a click outside closes it.
// Opening moves the focus to the close button; closing gives it back to the thumbnail (keyboard users, qa A15).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslation } from "@/i18n";

interface Props {
  url: string;
  label: string;
  onBroken: () => void;
}

export function MediaImage({ url, label, onBroken }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wasOpen = useRef(false);
  const thumbnail = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      closeButton.current?.focus();
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") setOpen(false);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      thumbnail.current?.focus();
    }
    return undefined;
  }, [open]);

  return (
    <>
      <button ref={thumbnail} type="button" onClick={() => setOpen(true)} aria-label={t.crm.whatsapp.media.openImage} className="block cursor-zoom-in">
        {/* eslint-disable-next-line @next/next/no-img-element -- a signed link that expires: not for the image optimizer */}
        <img src={url} alt={label} onError={onBroken} className="max-h-64 max-w-full rounded-lg object-contain" />
      </button>
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            style={{ fontFamily: "var(--font-family-base), system-ui, sans-serif" }}
          >
            <button
              ref={closeButton}
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.crm.whatsapp.media.closeImage}
              className="absolute right-4 top-4 rounded-full bg-white p-2 text-gray-900"
            >
              <X size={18} aria-hidden="true" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- same signed link */}
            <img src={url} alt={label} onClick={(event) => event.stopPropagation()} className="max-h-full max-w-full rounded-lg object-contain" />
          </div>,
          document.body,
        )}
    </>
  );
}
