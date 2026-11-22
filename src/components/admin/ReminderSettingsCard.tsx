"use client";
// src/components/admin/ReminderSettingsCard.tsx
// Reminder timing and confirmation rules. Saves on its own through /api/tenants/reminders, sending only these fields.
// The reminder goes out `reminderLeadMinutes` before the visit; the visit is released `confirmationDeadlineMinutes`
// before it. The screen shows hours in half-hour steps; the stored values are minutes.
import { useEffect, useState } from "react";
import { BellRing, Check, Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "@/i18n";
import { translateApiError } from "@/i18n/validation";
import { fill } from "@/lib/utils";
import NumberField from "@/components/ui/NumberField";
import type { BusinessHours } from "@/lib/business-hours";
import { clockOf, reminderQuietConflict } from "@/lib/reminder-quiet-hours";

interface TimingSettings {
  remindersEnabled: boolean;
  reminderLeadMinutes: number;
  confirmationRequired: boolean;
  confirmationDeadlineMinutes: number;
  // Ban prevention: consent-gate mode and quiet hours.
  messagingPolicyMode: "SHADOW" | "ENFORCE";
  quietHoursStartMin: number | null;
  quietHoursEndMin: number | null;
  /** The weekly hours (read-only here, edited in /admin/negocio): used to check reminders against quiet hours. */
  businessHours?: BusinessHours;
}

// Quiet-hours defaults when the tenant has not set them (same as src/lib/wa-pacing.ts).
const DEFAULT_QUIET_START_HOUR = 21;
const DEFAULT_QUIET_END_HOUR = 8;
const hourOf = (minutes: number | null, fallback: number) => (minutes == null ? fallback : Math.floor(minutes / 60));

// Minutes shown as hours (1.5 = 1 h 30 min) and back.
const toHours = (minutes: number) => minutes / 60;
const toMinutes = (hours: number) => Math.round(hours * 60);

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
          reminderLeadMinutes: settings.reminderLeadMinutes,
          confirmationRequired: settings.confirmationRequired,
          confirmationDeadlineMinutes: settings.confirmationDeadlineMinutes,
          messagingPolicyMode: settings.messagingPolicyMode,
          quietHoursStartMin: settings.quietHoursStartMin,
          quietHoursEndMin: settings.quietHoursEndMin,
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

  // Same bounds as the API (/api/tenants/reminders): lead 1 to 72 h, deadline 30 min to 48 h, in steps of 30 min,
  // and the deadline always earlier than the reminder.
  const leadOk = settings.reminderLeadMinutes >= 60 && settings.reminderLeadMinutes <= 4320 && settings.reminderLeadMinutes % 30 === 0;
  const deadlineOk =
    settings.confirmationDeadlineMinutes >= 30 && settings.confirmationDeadlineMinutes <= 2880 && settings.confirmationDeadlineMinutes % 30 === 0;
  // No reminder inside the quiet hours (QA 2026-11-20): the same rule the API checks on save.
  const quietConflict =
    settings.remindersEnabled && settings.businessHours
      ? reminderQuietConflict(
          settings.businessHours,
          settings.reminderLeadMinutes,
          settings.quietHoursStartMin ?? DEFAULT_QUIET_START_HOUR * 60,
          settings.quietHoursEndMin ?? DEFAULT_QUIET_END_HOUR * 60,
        )
      : null;
  const settingsValid =
    leadOk && deadlineOk && settings.confirmationDeadlineMinutes < settings.reminderLeadMinutes && quietConflict === null;
  const timingValid = leadOk && deadlineOk && settings.confirmationDeadlineMinutes < settings.reminderLeadMinutes;

  // Time the customer has between the reminder and the release.
  const windowMinutes = settings.reminderLeadMinutes - settings.confirmationDeadlineMinutes;
  const windowText =
    windowMinutes >= 60 ? fill(tx.reminderWindowLine, { hours: toHours(windowMinutes) }) : tx.reminderWindowShort;

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
          className="check-themed w-5 h-5 mt-0"
        />
      </label>

      <div className="space-y-1.5">
        <label htmlFor="reminder-lead" className="block text-sm font-medium text-gray-900 dark:text-white">
          {tx.reminderLeadLabel}
        </label>
        <NumberField
          id="reminder-lead"
          value={toHours(settings.reminderLeadMinutes)}
          min={1}
          max={72}
          step={0.5}
          onCommit={(hours) => update({ reminderLeadMinutes: toMinutes(hours) })}
          className="sm:w-40"
        />
      </div>

      <label className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{tx.confirmationRequiredLabel}</span>
        <input
          type="checkbox"
          checked={settings.confirmationRequired}
          onChange={(e) => update({ confirmationRequired: e.target.checked })}
          className="check-themed w-5 h-5 mt-0"
        />
      </label>
      {settings.confirmationRequired && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 dark:text-gray-400">{tx.confirmationRequiredHint}</p>
          <label htmlFor="reminder-deadline" className="block text-sm font-medium text-gray-900 dark:text-white">
            {tx.deadlineHoursLabel}
          </label>
          <NumberField
            id="reminder-deadline"
            value={toHours(settings.confirmationDeadlineMinutes)}
            min={0.5}
            max={48}
            step={0.5}
            onCommit={(hours) => update({ confirmationDeadlineMinutes: toMinutes(hours) })}
            className="sm:w-40"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">{windowText}</p>
        </div>
      )}

      {!timingValid && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-center gap-3 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span>{tx.reminderWindowInvalid}</span>
        </div>
      )}

      {/* Ban prevention: quiet hours and strict consent. */}
      <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{tx.quietHoursLabel}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{tx.quietHoursHint}</p>
          <div className="flex items-center gap-3 pt-1">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              {tx.quietHoursFrom}
              <select
                className="input select-themed w-24"
                value={hourOf(settings.quietHoursStartMin, DEFAULT_QUIET_START_HOUR)}
                onChange={(e) => update({ quietHoursStartMin: Number(e.target.value) * 60 })}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              {tx.quietHoursTo}
              <select
                className="input select-themed w-24"
                value={hourOf(settings.quietHoursEndMin, DEFAULT_QUIET_END_HOUR)}
                onChange={(e) => update({ quietHoursEndMin: Number(e.target.value) * 60 })}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {quietConflict && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-start gap-3 text-red-700 dark:text-red-300 text-sm"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{fill(tx.reminderQuietConflict, { visit: clockOf(quietConflict.visitMin), reminder: clockOf(quietConflict.reminderMin) })}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-gray-900 dark:text-white">{tx.strictConsentLabel}</span>
            <input
              type="checkbox"
              className="check-themed w-5 h-5 mt-0"
              checked={settings.messagingPolicyMode === "ENFORCE"}
              onChange={(e) => update({ messagingPolicyMode: e.target.checked ? "ENFORCE" : "SHADOW" })}
            />
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">{tx.strictConsentHint}</p>
        </div>
      </div>


      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-center gap-3 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <span className="text-xs font-semibold text-primary">
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
          disabled={saving || !settingsValid}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[color:var(--on-primary)] bg-primary hover:bg-primary/90 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          <span>{tx.saveRemindersBtn}</span>
        </button>
      </div>
    </section>
  );
}
