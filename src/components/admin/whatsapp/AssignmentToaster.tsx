"use client";
// src/components/admin/whatsapp/AssignmentToaster.tsx
// The in-app notice when the owner puts this person in charge of a WhatsApp chat: who the customer is, why the chat
// needs help, and what to do. It shows on any admin screen, once per assignment (the seen list is kept in this browser
// only, so a reload does not repeat it). The WhatsApp reminder for the same assignment is sent by the server.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserCheck, X } from "lucide-react";
import { assignmentKey, newAssignments, type AssignmentView } from "@/lib/help-view";
import { useHelpTexts } from "./HelpRowBadge";

const REFRESH_MS = 15_000;
const VISIBLE_MS = 15_000;
const MAX_VISIBLE = 3;
const SEEN_STORAGE_KEY = "newaigent.help.seenAssignments";
const SEEN_LIMIT = 200;

function readSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSeen(seen: Set<string>): void {
  try {
    window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(Array.from(seen).slice(-SEEN_LIMIT)));
  } catch {
    // Storage can be blocked: the notice then may repeat after a reload, which is harmless.
  }
}

export default function AssignmentToaster() {
  const { help, reasonText } = useHelpTexts();
  const [visible, setVisible] = useState<AssignmentView[]>([]);
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/apps/whatsapp/help-count", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { assignments?: AssignmentView[] };
        if (!seenRef.current) seenRef.current = readSeen();
        const fresh = newAssignments(data.assignments ?? [], seenRef.current, new Date());
        if (fresh.length === 0) return;
        for (const item of fresh) seenRef.current.add(assignmentKey(item));
        writeSeen(seenRef.current);
        setVisible((current) => [...current, ...fresh].slice(-MAX_VISIBLE));
        for (const item of fresh) {
          window.setTimeout(() => setVisible((current) => current.filter((x) => x.id !== item.id || x.assignedAt !== item.assignedAt)), VISIBLE_MS);
        }
      } catch {
        // The check runs again in a few seconds; a failed one shows nothing.
      }
    };
    void check();
    const timer = window.setInterval(check, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (visible.length === 0) return null;
  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[70] w-[min(22rem,calc(100vw-2rem))] space-y-2">
      {visible.map((item) => (
        <div
          key={assignmentKey(item)}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg p-4 flex gap-3"
        >
          <UserCheck size={18} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{help.assignedTitle}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
              {item.contact} · {reasonText(item.reason)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{item.priority > 0 ? help.assignedUrgent : help.assignedPlain}</p>
            <Link href={`/admin/whatsapp?chat=${item.id}`} className="inline-block text-sm font-medium text-primary hover:underline">
              {help.openChat}
            </Link>
          </div>
          <button
            type="button"
            aria-label={help.dismissNotice}
            onClick={() => setVisible((current) => current.filter((x) => x.id !== item.id || x.assignedAt !== item.assignedAt))}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white shrink-0 self-start"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
