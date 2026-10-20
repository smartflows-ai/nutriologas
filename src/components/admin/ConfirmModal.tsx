"use client";
// src/components/admin/ConfirmModal.tsx
// Confirmation dialog for destructive or important CRM actions. Uses the tenant tokens and the shared button classes.
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "@/i18n";

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "primary";
}

export default function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, variant = "primary" }: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="bg-white dark:bg-gray-950 rounded-xl shadow-lg w-full max-w-md p-6 border border-gray-200 dark:border-gray-800 animate-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0">
            <h3 id="confirm-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end mt-6">
          <button onClick={onCancel} className="btn-ghost px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300">
            {t.integrationsUi.cancel}
          </button>
          <button
            onClick={onConfirm}
            className={
              variant === "danger"
                ? "px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-colors"
                : "btn-primary px-5 py-2.5 text-sm font-semibold"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
