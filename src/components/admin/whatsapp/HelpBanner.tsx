"use client";
// src/components/admin/whatsapp/HelpBanner.tsx
// The band above an open chat that needs a person: reason, priority, how long it waits, who is in charge, and the
// actions (take, mark handled, assign). Only the owner sees "assign".
import { AlertCircle, AlertTriangle, Check, UserCheck } from "lucide-react";
import { helpTone } from "@/lib/help-view";
import { HELP_TEXT_CLASS } from "./helpTone";
import { useHelpTexts } from "./HelpRowBadge";

export interface HelpAssistant {
  id: string;
  name: string | null;
  email: string;
  whatsappNumber: string | null;
}

interface Props {
  helpReason: string | null;
  helpPriority: number;
  helpRequestedAt: string | null;
  isTaken: boolean;
  wroteAgain?: boolean;
  assignedToId: string | null;
  assignedToName: string | null;
  assistants: HelpAssistant[];
  canAssign: boolean;
  busy: boolean;
  now: Date;
  onTake: () => void;
  onResolve: () => void;
  onAssign: (assigneeId: string | null) => void;
}

const BUTTON_CLASS = "btn-secondary inline-flex items-center justify-center gap-1.5 min-h-11 sm:min-h-0 text-sm disabled:opacity-50";

export default function HelpBanner(props: Props) {
  const { help, reasonText, waitingText } = useHelpTexts();
  const tone = helpTone(props.helpPriority);
  if (tone === "none") return null;
  const Icon = tone === "high" ? AlertTriangle : AlertCircle;
  const priorityLabel = props.helpPriority >= 3 ? help.priority.critical : props.helpPriority === 2 ? help.priority.high : help.priority.medium;
  const waited = waitingText(props.helpRequestedAt, props.now);
  const inCharge = props.assignedToName || (props.assignedToId ? "" : help.unassigned);

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${HELP_TEXT_CLASS[tone]}`}>
          <Icon size={16} aria-hidden="true" />
          {help.needsHelp}: {reasonText(props.helpReason)}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {priorityLabel}
          {waited ? ` · ${help.waiting} ${waited}` : ""}
          {props.wroteAgain ? ` · ${help.wroteAgain}` : ""}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {props.isTaken ? `${help.taking}: ` : `${help.inCharge}: `}
          {inCharge}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!props.isTaken && (
          <button type="button" disabled={props.busy} onClick={props.onTake} className={BUTTON_CLASS}>
            <UserCheck size={14} aria-hidden="true" />
            {help.take}
          </button>
        )}
        <button type="button" disabled={props.busy} onClick={props.onResolve} className={BUTTON_CLASS}>
          <Check size={14} aria-hidden="true" />
          {help.resolve}
        </button>
        {props.canAssign && (
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span className="whitespace-nowrap">{help.assign}</span>
            <select
              className="input py-1.5 text-sm"
              disabled={props.busy}
              value={props.assignedToId ?? ""}
              onChange={(event) => props.onAssign(event.target.value === "" ? null : event.target.value)}
            >
              <option value="">{help.assignNone}</option>
              {props.assistants.map((assistant) => (
                <option key={assistant.id} value={assistant.id}>
                  {(assistant.name || assistant.email) + (assistant.whatsappNumber ? "" : help.assignNoWhatsapp)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
