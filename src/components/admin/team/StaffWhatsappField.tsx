"use client";
// src/components/admin/team/StaffWhatsappField.tsx
// The WhatsApp number a staff member receives "a chat needs help" notices on. The owner sets it; an empty value
// clears it. The server validates the number and refuses the business line and the owner's own number.
import { useState } from "react";
import { toast } from "@/hooks/useToast";
import { useTranslation } from "@/i18n";
import { translateApiError } from "@/i18n/validation";

interface Props {
  userId: string;
  /** Number stored for this user, or null when none. */
  value: string | null;
  disabled: boolean;
  onSaved: () => void;
}

export default function StaffWhatsappField({ userId, value, disabled, onSaved }: Props) {
  const { t } = useTranslation();
  const tx = t.team;
  const [draft, setDraft] = useState(value ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const inputId = `staff-whatsapp-${userId}`;
  const isChanged = draft.trim() !== (value ?? "");

  const save = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_whatsapp", whatsappNumber: draft }),
      });
      const data: { error?: string; whatsappNumber?: string | null } = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(translateApiError(t, data.error ?? "internal_error") ?? "");
        return;
      }
      setDraft(data.whatsappNumber ?? "");
      toast(tx.whatsappSaved);
      onSaved();
    } catch {
      toast(translateApiError(t, "internal_error") ?? "");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-3">
      <label htmlFor={inputId} className="block text-xs text-gray-500 dark:text-gray-400">
        {tx.whatsappLabel}
      </label>
      <div className="mt-1 flex flex-col sm:flex-row gap-2">
        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={draft}
          maxLength={24}
          disabled={disabled || isSaving}
          placeholder={tx.whatsappPlaceholder}
          onChange={(event) => setDraft(event.target.value)}
          className="input sm:max-w-xs"
        />
        <button
          type="button"
          disabled={disabled || isSaving || !isChanged}
          onClick={() => void save()}
          className="btn-secondary inline-flex items-center justify-center min-h-11 sm:min-h-0 disabled:opacity-50"
        >
          {tx.whatsappSave}
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{value ? tx.whatsappHint : tx.whatsappEmpty}</p>
    </div>
  );
}
