"use client";
// src/components/admin/team/TempPasswordDialog.tsx
// Shows a temporary password once, right after the owner creates a user or resets a password.
// It lives only in this component's props: it is never stored, and closing the dialog drops it.
import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { useTranslation } from "@/i18n";

interface Props {
  name: string;
  password: string;
  onClose: () => void;
}

export default function TempPasswordDialog({ name, password, onClose }: Props) {
  const { t } = useTranslation();
  const tx = t.team;
  const [isCopied, setIsCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setIsCopied(true);
      setCopyFailed(false);
    } catch {
      // Clipboard blocked by the browser: the owner can still select the text by hand.
      setCopyFailed(true);
    }
  };

  // No close on backdrop click or Escape: the password cannot be shown again, so closing must be deliberate.
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="temp-password-title"
        aria-describedby="temp-password-body"
        className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 w-full max-w-md p-6"
      >
        <h3 id="temp-password-title" className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <KeyRound size={20} className="text-primary shrink-0" aria-hidden="true" />
          {tx.tempTitle}
        </h3>
        <p id="temp-password-body" className="text-sm text-gray-600 dark:text-gray-300 mt-2 break-words">
          {tx.tempBody.replace("{name}", () => name)}
        </p>

        <div className="mt-4 flex items-stretch gap-2">
          <code className="flex-1 min-w-0 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-base font-mono text-gray-900 dark:text-white break-all select-all">
            {password}
          </code>
          <button type="button" onClick={copy} className="btn-secondary inline-flex items-center gap-2 min-h-11 shrink-0">
            {isCopied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {isCopied ? tx.copied : tx.copy}
          </button>
        </div>
        {copyFailed && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{tx.copyFailed}</p>}

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{tx.tempWarning}</p>

        <div className="flex justify-end mt-6">
          {/* Focus lands here: the dialog that opened this one is gone, and a keyboard or screen-reader user
              must be told that a one-time password is on screen. */}
          <button type="button" autoFocus onClick={onClose} className="btn-primary text-[color:var(--on-primary)] min-h-11 px-5">
            {tx.done}
          </button>
        </div>
      </div>
    </div>
  );
}
