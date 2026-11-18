"use client";
// src/components/admin/whatsapp/HelpRowBadge.tsx
// The line of a chat row that says why it needs a person and for how long: icon, reason and waiting time.
import { AlertCircle, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/i18n";
import { helpTone, reasonLabelKey, waitingParts } from "@/lib/help-view";
import { HELP_TEXT_CLASS } from "./helpTone";

interface Props {
  helpReason: string | null;
  helpPriority: number;
  helpRequestedAt: string | null;
  now: Date;
}

export function useHelpTexts() {
  const { t } = useTranslation();
  const help = t.crm.whatsapp.help;
  const reasonText = (reason: string | null): string => {
    const key = reasonLabelKey(reason);
    return key ? ((help.reason as Record<string, string>)[key] ?? help.needsHelp) : help.needsHelp;
  };
  const waitingText = (since: string | null, now: Date): string => {
    const waited = waitingParts(now, since);
    if (!waited) return "";
    return `${waited.value} ${waited.unit === "minutes" ? help.unitMinutes : help.unitHours}`;
  };
  return { help, reasonText, waitingText };
}

export default function HelpRowBadge({ helpReason, helpPriority, helpRequestedAt, now }: Props) {
  const { reasonText, waitingText } = useHelpTexts();
  const tone = helpTone(helpPriority);
  if (tone === "none") return null;
  const Icon = tone === "high" ? AlertTriangle : AlertCircle;
  const waited = waitingText(helpRequestedAt, now);
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium mb-0.5 ${HELP_TEXT_CLASS[tone]}`}>
      <Icon size={12} aria-hidden="true" />
      <span className="truncate">{reasonText(helpReason)}</span>
      {waited && <span className="font-normal opacity-80 shrink-0 whitespace-nowrap">· {waited}</span>}
    </span>
  );
}
