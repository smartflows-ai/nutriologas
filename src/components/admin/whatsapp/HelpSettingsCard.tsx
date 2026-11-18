"use client";
// src/components/admin/whatsapp/HelpSettingsCard.tsx
// How long an assistant has to take a chat that needs help before the owner is told. Saves on its own through
// /api/tenants/help, sending only this field. The check runs every 15 minutes, so the choices go in steps of 15.
import { useEffect, useState } from "react";
import { AlertCircle, Check, LifeBuoy, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { translateApiError } from "@/i18n/validation";
import { ESCALATION_MAX_MINUTES, ESCALATION_MIN_MINUTES, ESCALATION_STEP_MINUTES } from "@/lib/help-routing";
import NumberField from "@/components/ui/NumberField";

interface HelpSettings {
  helpEscalationMinutes: number;
  assistantCount: number;
}

export default function HelpSettingsCard() {
  const { t } = useTranslation();
  const tx = t.crm.whatsapp.help;
  const [settings, setSettings] = useState<HelpSettings | null>(null);
  const [minutes, setMinutes] = useState<number>(ESCALATION_MIN_MINUTES);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenants/help")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load"))))
      .then((data: HelpSettings) => {
        setSettings(data);
        setMinutes(data.helpEscalationMinutes);
      })
      .catch(() => setError(tx.settingsError));
  }, [tx.settingsError]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tenants/help", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpEscalationMinutes: minutes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(translateApiError(t, data.error) || tx.settingsError);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tx.settingsError);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return error ? (
      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-center gap-3 text-red-700 dark:text-red-300 text-sm">
        <AlertCircle size={18} className="shrink-0" />
        <span>{error}</span>
      </div>
    ) : null;
  }

  return (
    <section className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 space-y-5">
      <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-gray-800">
        <LifeBuoy size={20} className="text-primary" />
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white text-base">{tx.settingsTitle}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{tx.settingsBody}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="help-escalation" className="block text-sm font-medium text-gray-900 dark:text-white">
          {tx.settingsMinutes}
        </label>
        <NumberField
          id="help-escalation"
          value={minutes}
          min={ESCALATION_MIN_MINUTES}
          max={ESCALATION_MAX_MINUTES}
          step={ESCALATION_STEP_MINUTES}
          onCommit={(value) => {
            setSaved(false);
            setMinutes(value);
          }}
          className="sm:w-40"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">{tx.settingsPrecision}</p>
        {settings.assistantCount === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{tx.settingsNoAssistants}</p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || minutes === settings.helpEscalationMinutes}
          className="btn-primary inline-flex items-center justify-center gap-2 min-h-11 sm:min-h-0 disabled:opacity-50"
        >
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {tx.settingsSave}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
            <Check size={16} aria-hidden="true" />
            {tx.settingsSaved}
          </span>
        )}
      </div>
    </section>
  );
}
