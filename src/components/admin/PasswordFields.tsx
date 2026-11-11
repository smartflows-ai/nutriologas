"use client";
// src/components/admin/PasswordFields.tsx
// Password section of the business page. Controlled: the page owns the values and saves them with its one Save button.
import { Eye, EyeOff, Lock } from "lucide-react";
import { useTranslation } from "@/i18n";

export interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const EMPTY_PASSWORD_VALUES: PasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

// True when the owner typed anything in the password section (so the page must save it).
export const isPasswordFormTouched = (values: PasswordFormValues): boolean =>
  Object.values(values).some((value) => value.length > 0);

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary";
const LABEL_CLASS = "block text-sm font-medium text-gray-900 dark:text-white";

interface PasswordFieldsProps {
  // null while the server has not said whether the account already has a password.
  hasPassword: boolean | null;
  values: PasswordFormValues;
  showPasswords: boolean;
  onChange: (field: keyof PasswordFormValues, value: string) => void;
  onToggleShow: () => void;
  // Replaces the default text under the title, which speaks to the business owner. The change-password
  // screen is also used by the team, so it passes its own.
  description?: string;
}

export default function PasswordFields({ hasPassword, values, showPasswords, onChange, onToggleShow, description }: PasswordFieldsProps) {
  const { t } = useTranslation();
  const tx = t.crm.business.security;
  const isCreating = hasPassword === false;
  const toggleLabel = showPasswords ? tx.hidePassword : tx.showPassword;
  const inputType = showPasswords ? "text" : "password";
  const disabled = hasPassword === null;

  return (
    <section className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-start gap-2.5">
          <Lock size={20} strokeWidth={2} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white text-base">
              {isCreating ? tx.createTitle : tx.title}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {description ?? (isCreating ? tx.createDescription : tx.description)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleShow}
          aria-label={toggleLabel}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white cursor-pointer"
        >
          {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
          <span className="hidden sm:inline">{toggleLabel}</span>
        </button>
      </div>

      {hasPassword && (
        <div className="space-y-1.5">
          <label htmlFor="current-password" className={LABEL_CLASS}>
            {tx.currentPassword}
          </label>
          <input
            id="current-password"
            type={inputType}
            autoComplete="current-password"
            disabled={disabled}
            value={values.currentPassword}
            onChange={(e) => onChange("currentPassword", e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="new-password" className={LABEL_CLASS}>
            {tx.newPassword}
          </label>
          <input
            id="new-password"
            type={inputType}
            autoComplete="new-password"
            disabled={disabled}
            value={values.newPassword}
            onChange={(e) => onChange("newPassword", e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm-password" className={LABEL_CLASS}>
            {tx.confirmPassword}
          </label>
          <input
            id="confirm-password"
            type={inputType}
            autoComplete="new-password"
            disabled={disabled}
            value={values.confirmPassword}
            onChange={(e) => onChange("confirmPassword", e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">{tx.hint}</p>
    </section>
  );
}
