"use client";
// src/components/admin/whatsapp/HelpCountBadge.tsx
// The counter next to "WhatsApp" in the sidebar: chats that need a person and nobody has taken yet. The owner sees the
// whole business; an assistant sees the chats the owner put in charge of them.
// Red when any of them is high priority, amber otherwise; the number is always shown, color is not the only signal.
import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n";
import { useCan } from "@/components/admin/TenantMeta";
import { HELP_COUNT_CLASS } from "./helpTone";

const REFRESH_MS = 15_000;

interface Count {
  open: number;
  high: number;
}

interface HelpCounts {
  open: number;
  high: number;
  mine: number;
  mineHigh: number;
}

export default function HelpCountBadge({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const isOwner = useCan("users.manage");
  const [count, setCount] = useState<Count>({ open: 0, high: 0 });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/apps/whatsapp/help-count", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as HelpCounts;
        setCount(isOwner ? { open: data.open ?? 0, high: data.high ?? 0 } : { open: data.mine ?? 0, high: data.mineHigh ?? 0 });
      } catch {
        // A failed refresh keeps the last number: the counter is a hint, not a record.
      }
    };
    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isOwner]);

  if (count.open === 0) return null;
  const tone = HELP_COUNT_CLASS[count.high > 0 ? "high" : "medium"];
  return (
    <span
      className={`${tone} text-xs font-semibold rounded-full min-w-5 h-5 px-1.5 inline-flex items-center justify-center ${compact ? "absolute -top-1 -right-1" : "ml-auto"}`}
      aria-label={`${t.crm.whatsapp.help.filterNeedHelp}: ${count.open}`}
    >
      {count.open}
    </span>
  );
}
