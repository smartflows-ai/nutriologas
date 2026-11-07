// src/components/admin/StaffNoSections.tsx
// Shown at /admin when a STAFF account has no section the business offers (no bookings, no WhatsApp, no history).
// A screen instead of a redirect, so there is never a redirect loop.
import { LayoutGrid } from "lucide-react";
import type { Translations } from "@/i18n/types";

interface StaffNoSectionsProps {
  readonly t: Translations;
}

export default function StaffNoSections({ t }: StaffNoSectionsProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card max-w-md text-center">
        <LayoutGrid size={28} strokeWidth={1.75} className="mx-auto mb-3 text-primary" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{t.staffUi.noSectionsTitle}</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t.staffUi.noSectionsBody}</p>
      </div>
    </div>
  );
}
