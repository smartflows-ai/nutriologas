"use client";
// src/components/admin/ReminderMessagesCard.tsx
// Customer message settings: language and the reminder, confirmation and cancellation texts.
// Saves on its own through /api/tenants/reminders, sending only these fields.
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, AlertCircle, MessageSquare, Wrench } from "lucide-react";
import { useTranslation } from "@/i18n";
import { translateApiError } from "@/i18n/validation";
import { es } from "@/i18n/es";
import { en } from "@/i18n/en";
import { suggestFix, templateIssues, unfilledFields, type TemplateIssue, type TemplateKind } from "@/lib/reminder-template-rules";

interface MessageSettings {
  messageLanguage: "es" | "en";
  reminderTemplate: string | null;
  confirmationTemplate: string | null;
  cancellationTemplate: string | null;
  invalidTemplates?: ("reminder" | "confirmation" | "cancellation")[];
  ownerName?: string | null;
  locationReady?: boolean;
}

const inputClass =
  "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary scrollbar-slim";

export default function ReminderMessagesCard() {
  const { t } = useTranslation();
  const tx = t.crm.business;
  const [settings, setSettings] = useState<MessageSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The "saved" notice hides itself after 3 s; the timer is cleared if the card leaves the page first.
  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

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
      // Merge: keep the business fields (owner name, location) the card needs to check the texts.
      setSettings((current) => ({
        ...current,
        messageLanguage: data.messageLanguage,
        reminderTemplate: data.reminderTemplate,
        confirmationTemplate: data.confirmationTemplate,
        cancellationTemplate: data.cancellationTemplate,
      }));
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || tx.reminderLoadError);
    } finally {
      setSaving(false);
    }
  };

  const invalidLabels = { reminder: tx.reminderTemplateLabel, confirmation: tx.confirmationTemplateLabel, cancellation: tx.cancellationTemplateLabel };
  const invalidNames = (settings?.invalidTemplates ?? []).map((kind) => invalidLabels[kind]);

  // The same checks the server runs, while the owner types: a text with a problem cannot be saved.
  const issuesByKind: Record<TemplateKind, TemplateIssue[]> = {
    reminder: settings?.reminderTemplate?.trim() ? templateIssues(settings.reminderTemplate.trim(), "reminder") : [],
    confirmation: settings?.confirmationTemplate?.trim() ? templateIssues(settings.confirmationTemplate.trim(), "confirmation") : [],
    cancellation: settings?.cancellationTemplate?.trim() ? templateIssues(settings.cancellationTemplate.trim(), "cancellation") : [],
  };
  // Fields a text uses that the business has not filled in: the save is refused and the error names the field.
  const fieldsData = { ownerName: settings?.ownerName, hasLocation: Boolean(settings?.locationReady) };
  const unfilledByKind: Record<TemplateKind, string[]> = {
    reminder: settings?.reminderTemplate?.trim() ? unfilledFields(settings.reminderTemplate.trim(), fieldsData) : [],
    confirmation: settings?.confirmationTemplate?.trim() ? unfilledFields(settings.confirmationTemplate.trim(), fieldsData) : [],
    cancellation: settings?.cancellationTemplate?.trim() ? unfilledFields(settings.cancellationTemplate.trim(), fieldsData) : [],
  };
  const unfilledMessages = Array.from(new Set(Object.values(unfilledByKind).flat())).map((field) =>
    translateApiError(t, field === "responsable" ? "template_needs_owner_name" : "template_needs_location"),
  );
  const textIssues = Object.values(issuesByKind).some((list) => list.length > 0);
  const onlyUnfilled = !textIssues && unfilledMessages.length > 0;
  const hasIssues = textIssues || unfilledMessages.length > 0;

  // What goes out when a field is left empty: shown in the field so the owner can read it.
  const defaults = (settings?.messageLanguage === "en" ? en : es).customerMessages;

  // The deadline time only exists in the confirmation text, and the location only in the reminder and the
  // confirmation (a cancelled visit has no place to go to); offering them elsewhere would send them with brackets.
  const cancellationDetails = [tx.tokenService, tx.tokenDate, tx.tokenTime, tx.tokenBusiness, tx.tokenOwner, tx.tokenName];
  const reminderDetails = [...cancellationDetails, tx.tokenLocation];
  const confirmationDetails = [tx.tokenService, tx.tokenDate, tx.tokenTime, tx.tokenDeadline, tx.tokenBusiness, tx.tokenOwner, tx.tokenName, tx.tokenLocation];

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
          issues={issuesByKind.reminder}
          kind="reminder"
          defaultText={defaults.reminderTemplate}
          label={tx.reminderTemplateLabel}
          value={settings.reminderTemplate}
          onChange={(value) => update({ reminderTemplate: value })}
          detailNames={reminderDetails}
          insertLabel={tx.templateInsertLabel}
        />
        <TemplateField
          id="confirmation-template"
          issues={issuesByKind.confirmation}
          kind="confirmation"
          defaultText={defaults.confirmationTemplate}
          label={tx.confirmationTemplateLabel}
          value={settings.confirmationTemplate}
          onChange={(value) => update({ confirmationTemplate: value })}
          detailNames={confirmationDetails}
          insertLabel={tx.templateInsertLabel}
          snippet={{ label: tx.addConfirmationRequest, text: (settings.messageLanguage === "en" ? en : es).crm.business.confirmationRequestSnippet }}
        />
        <TemplateField
          id="cancellation-template"
          issues={issuesByKind.cancellation}
          kind="cancellation"
          defaultText={defaults.cancellationTemplate}
          label={tx.cancellationTemplateLabel}
          value={settings.cancellationTemplate}
          onChange={(value) => update({ cancellationTemplate: value })}
          detailNames={cancellationDetails}
          insertLabel={tx.templateInsertLabel}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">{tx.templateDefaultHint}</p>
        {invalidNames.length > 0 && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-start gap-3 text-amber-800 dark:text-amber-300 text-sm"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{tx.invalidStoredTemplates.replace("{names}", invalidNames.join(", "))}</span>
          </div>
        )}
      </div>

      {unfilledMessages.length > 0 && (
        <div role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-start gap-3 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div className="space-y-1">
            {unfilledMessages.map((m, i) => (
              <p key={i}>{m}</p>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-center gap-3 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 pt-2">
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {hasIssues && (
            <span id="template-issues-hint" className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <AlertCircle size={14} />
              {onlyUnfilled ? tx.fillFieldsToSave : tx.fixTemplatesToSave}
            </span>
          )}
          {!hasIssues && saved && (
            <span className="inline-flex items-center gap-1.5">
              <Check size={14} />
              {tx.savedReminders}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || hasIssues}
          aria-describedby={hasIssues ? "template-issues-hint" : undefined}
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
  snippet,
  issues,
  kind,
  defaultText,
}: {
  id: string;
  issues: TemplateIssue[];
  kind: TemplateKind;
  defaultText: string;
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  detailNames: string[];
  insertLabel: string;
  /** A ready-made sentence the owner can add with one click (the confirmation request). */
  snippet?: { label: string; text: string };
}) {
  const { t } = useTranslation();
  const tx = t.crm.business;
  const ref = useRef<HTMLTextAreaElement>(null);
  const hasIssues = issues.length > 0;

  // Selects the fragment in the text so the owner sees exactly where it is.
  const locate = (fragment: string) => {
    const el = ref.current;
    const start = el ? el.value.indexOf(fragment) : -1;
    if (!el || start < 0) return;
    el.focus();
    el.setSelectionRange(start, start + fragment.length);
  };

  const insertText = (token: string) => {
    const text = value ?? "";
    const el = ref.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    onChange(text.slice(0, start) + token + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const insert = (detail: string) => insertText(`[${detail}]`);

  // The confirmation request goes in its own paragraph at the end, so it never lands in the middle of a sentence.
  const addSnippet = () => {
    if (!snippet) return;
    const text = (value ?? "").trimEnd();
    onChange(text ? `${text}\n\n${snippet.text}` : snippet.text);
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
        placeholder={defaultText}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={hasIssues}
        aria-describedby={hasIssues ? `${id}-issues` : undefined}
        className={hasIssues ? `${inputClass} border-red-400 dark:border-red-500 focus:border-red-500` : inputClass}
      />
      {hasIssues && (
        <ul id={`${id}-issues`} className="space-y-1.5" role="alert">
          {issues.map((issue) => (
            <li key={issue.code} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-red-700 dark:text-red-300">
              <AlertCircle size={14} className="shrink-0" />
              <span>{translateApiError(t, issue.code)}</span>
              {Array.from(new Set(issue.fragments)).map((fragment) => (
                <button
                  key={fragment}
                  type="button"
                  onClick={() => locate(fragment)}
                  title={tx.locateInText}
                  className="px-1.5 py-0.5 rounded-md font-mono bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950"
                >
                  {fragment}
                </button>
              ))}
              {issue.code === "confirmation_missing_si" && snippet && (
                <button
                  type="button"
                  onClick={addSnippet}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <Wrench size={12} />
                  {snippet.label}
                </button>
              )}
              {(() => {
                const fix = suggestFix(value ?? "", issue, kind, tx.tokenTime);
                if (!fix) return null;
                const label =
                  fix.action === "replace_time"
                    ? tx.fixReplaceWithTime.replace("{tag}", tx.tokenTime)
                    : fix.action === "remove_paragraph"
                      ? tx.fixRemoveParagraph
                      : tx.fixRemoveFragment;
                return (
                  <button
                    type="button"
                    onClick={() => onChange(fix.text)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Wrench size={12} />
                    {label}
                  </button>
                );
              })()}
            </li>
          ))}
        </ul>
      )}
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
        {snippet && (
          <button
            type="button"
            onClick={addSnippet}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {snippet.label}
          </button>
        )}
      </div>
    </div>
  );
}
