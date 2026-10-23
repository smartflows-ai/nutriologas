"use client";
// src/components/admin/ReminderSettingsCard.tsx
// Reminder timing and confirmation rules. Saves on its own through /api/tenants/reminders, sending only these fields.
import { useEffect, useState } from "react";
import { BellRing, Check, Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "@/i18n";
import { translateApiError } from "@/i18n/validation";

type ReminderMode = "DAY_BEFORE" | "SAME_DAY";

interface TimingSettings {
  remindersEnabled: boolean;
  reminderMode: ReminderMode;
  reminderSendTime: string;
  confirmationRequired: boolean;
  confirmationDeadlineHours: number;
}

const inputClass =
  "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary";

export default function ReminderSettingsCard() {
  const { t } = useTranslation();
  const tx = t.crm.business;
  const [settings, setSettings] = useState<TimingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenants/reminders")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load"))))
      .then((data: TimingSettings) => setSettings(data))
      .catch(() => setError(tx.reminderLoadError))
      .finally(() => setLoading(false));
  }, [tx.reminderLoadError]);

  const update = (patch: Partial<TimingSettings>) => {
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
          remindersEnabled: settings.remindersEnabled,
          reminderMode: settings.reminderMode,
          reminderSendTime: settings.reminderSendTime,
          confirmationRequired: settings.confirmationRequired,
          confirmationDeadlineHours: settings.confirmationDeadlineHours,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(translateApiError(t, data.error) || tx.reminderLoadError);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || tx.reminderLoadError);
    } finally {
      setSaving(false);
    }
  };

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
    <section className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 space-y-5">
      <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-gray-800">
        <BellRing size={20} className="text-primary" />
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white text-base">{tx.reminderSection}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{tx.reminderSectionDesc}</p>
        </div>
      </div>

      <label className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{tx.reminderEnabledLabel}</span>
        <input
          type="checkbox"
          checked={settings.remindersEnabled}
          onChange={(e) => update({ remindersEnabled: e.target.checked })}
          className="w-5 h-5 accent-primary"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-gray-900 dark:text-white">{tx.reminderModeLabel}</span>
          <select
            value={settings.reminderMode}
            onChange={(e) => update({ reminderMode: e.target.value as ReminderMode })}
            className={inputClass}
          >
            <option value="DAY_BEFORE">{tx.reminderModeDayBefore}</option>
            <option value="SAME_DAY">{tx.reminderModeSameDay}</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="reminder-send-time" className="block text-sm font-medium text-gray-900 dark:text-white">
            {tx.reminderSendTimeLabel}
          </label>
          <input
            id="reminder-send-time"
            type="time"
            value={settings.reminderSendTime}
            onChange={(e) => update({ reminderSendTime: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <label className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{tx.confirmationRequiredLabel}</span>
        <input
          type="checkbox"
          checked={settings.confirmationRequired}
          onChange={(e) => update({ confirmationRequired: e.target.checked })}
          className="w-5 h-5 accent-primary"
        />
      </label>
      {settings.confirmationRequired && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 dark:text-gray-400">{tx.confirmationRequiredHint}</p>
          <label htmlFor="reminder-deadline" className="block text-sm font-medium text-gray-900 dark:text-white">
            {tx.deadlineHoursLabel}
          </label>
          <input
            id="reminder-deadline"
            type="number"
            min={1}
            max={24}
            value={settings.confirmationDeadlineHours}
            onChange={(e) => update({ confirmationDeadlineHours: Number(e.target.value) })}
            className={`${inputClass} sm:w-40`}
          />
        </div>
      )}

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
          <span>{tx.saveRemindersBtn}</span>
        </button>
      </div>
    </section>
  );
}
