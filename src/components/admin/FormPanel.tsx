"use client";
// src/components/admin/FormPanel.tsx
// Modal form shared by the CRM add and edit screens (FAQ, carrusel, productos).
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslation } from "@/i18n";

interface Props {
  icon: ReactNode;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function FormPanel({ icon, title, onClose, children }: Props) {
  const { t } = useTranslation();

  // Escape closes the modal. The listener is removed when the modal unmounts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-panel-title"
        className="bg-white dark:bg-gray-950 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 id="form-panel-title" className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-lg">
            <span className="w-8 h-8 flex items-center justify-center">{icon}</span>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label={t.common.dismiss}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
