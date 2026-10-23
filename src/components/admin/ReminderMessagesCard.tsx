"use client";
// src/components/admin/ReminderMessagesCard.tsx
// Customer message settings: language and the reminder, confirmation and cancellation texts.
// Saves on its own through /api/tenants/reminders, sending only these fields.
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, AlertCircle, MessageSquare } from "lucide-react";
import { useTranslation } from "@/i18n";
import { translateApiError } from "@/i18n/validation";
import { es } from "@/i18n/es";
import { en } from "@/i18n/en";

interface MessageSettings {
  messageLanguage: "es" | "en";
  reminderTemplate: string | null;
  confirmationTemplate: string | null;
  cancellationTemplate: string | null;
}

const inputClass =
  "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary";

export default function ReminderMessagesCard() {
  const { t } = useTranslation();
  const tx = t.crm.business;
  const [settings, setSettings] = useState<MessageSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenants/reminders")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load"))))
      .then((data: MessageSettings) => setSettings(data))
      .catch(() => setError(tx.reminderLoadError))
      .finally(() => setLoading(false));
  }, [tx.reminderLoadError]);

  const update = (patch: Partial<MessageSettings>) => {
    setSaved(false);
    setSettings((current) => (current ? { ...current, ...patch } : current));
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tenants/reminders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageLanguage: settings.messageLanguage,
          reminderTemplate: settings.reminderTemplate?.trim() || null,
          confirmationTemplate: settings.confirmationTemplate?.trim() || null,
          cancellationTemplate: settings.cancellationTemplate?.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(translateApiError(t, data.error) || tx.reminderLoadError);
      }
      const data = await res.json();
      setSettings({
        messageLanguage: data.messageLanguage,
        reminderTemplate: data.reminderTemplate,
        confirmationTemplate: data.confirmationTemplate,
        cancellationTemplate: data.cancellationTemplate,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || tx.reminderLoadError);
    } finally {
      setSaving(false);
    }
  };

  const detailNames = [tx.tokenService, tx.tokenDate, tx.tokenTime, tx.tokenDeadline, tx.tokenBusiness];

  if (loading) return null;
  if (!settings) {
    return error ? (
      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-center gap-3 text-red-700 dark:text-red-300 text-sm">
        <AlertCircle size={18} className="shrink-0" />
        <span>{error}</span>
      </div>
    ) : null;
  }

  return (
    <section className="p-6 bg-white dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800 space-y-5">
      <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-gray-800">
        <MessageSquare size={20} className="text-primary" />
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white text-base">{tx.messagesSection}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{tx.messagesSectionDesc}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="message-language" className="block text-sm font-medium text-gray-900 dark:text-white">
          {tx.messageLanguageLabel}
        </label>
        <select
          id="message-language"
          value={settings.messageLanguage}
          onChange={(e) => update({ messageLanguage: e.target.value as "es" | "en" })}
          className={`${inputClass} sm:w-60`}
        >
          <option value="es">{es.customerMessages.confirmationLanguageName}</option>
          <option value="en">{en.customerMessages.confirmationLanguageName}</option>
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400">{tx.messageLanguageHint}</p>
      </div>

      <div className="space-y-4 pt-2">
        <TemplateField
          id="reminder-template"
          label={tx.reminderTemplateLabel}
          value={settings.reminderTemplate}
          onChange={(value) => update({ reminderTemplate: value })}
          detailNames={detailNames}
          insertLabel={tx.templateInsertLabel}
        />
        <TemplateField
          id="confirmation-template"
          label={tx.confirmationTemplateLabel}
          value={settings.confirmationTemplate}
          onChange={(value) => update({ confirmationTemplate: value })}
          detailNames={detailNames}
          insertLabel={tx.templateInsertLabel}
        />
        <TemplateField
          id="cancellation-template"
          label={tx.cancellationTemplateLabel}
          value={settings.cancellationTemplate}
          onChange={(value) => update({ cancellationTemplate: value })}
          detailNames={detailNames}
          insertLabel={tx.templateInsertLabel}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">{tx.templateDefaultHint}</p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-center gap-3 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {saved && (
            <span className="inline-flex items-center gap-1.5">
              <Check size={14} />
              {tx.savedReminders}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          <span>{tx.saveMessagesBtn}</span>
        </button>
      </div>
    </section>
  );
}

function TemplateField({
  id,
  label,
  value,
  onChange,
  detailNames,
  insertLabel,
}: {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  detailNames: string[];
  insertLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = (detail: string) => {
    const text = value ?? "";
    const el = ref.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const token = `[${detail}]`;
    onChange(text.slice(0, start) + token + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-900 dark:text-white">
        {label}
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={3}
        maxLength={600}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">{insertLabel}</span>
        {detailNames.map((detail) => (
          <button
            key={detail}
            type="button"
            onClick={() => insert(detail)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {detail}
          </button>
        ))}
      </div>
    </div>
  );
}
