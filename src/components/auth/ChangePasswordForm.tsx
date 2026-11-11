"use client";
// src/components/auth/ChangePasswordForm.tsx
// Form of the change-password page. It reuses the password fields of the business profile and the shared rules.
import { useState, type FormEvent } from "react";
import { LogOut } from "lucide-react";
import PasswordFields, { EMPTY_PASSWORD_VALUES, type PasswordFormValues } from "@/components/admin/PasswordFields";
import SignOutButton from "@/components/admin/SignOutButton";
import { useTranslation } from "@/i18n";
import { translateApiError, translateValidation } from "@/i18n/validation";
import { homeAfterSignIn } from "@/lib/home-after-sign-in";
import { passwordIssues, PASSWORD_FORM_MESSAGE } from "@/lib/password-rules";

interface Props {
  // True when the user signed in with a temporary password and cannot skip this screen.
  isForced: boolean;
}

export default function ChangePasswordForm({ isForced }: Props) {
  const { t } = useTranslation();
  const tx = t.passwordChange;
  const [values, setValues] = useState<PasswordFormValues>(EMPTY_PASSWORD_VALUES);
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // The same rules the server applies; the first problem is shown.
    const [issue] = passwordIssues(values.newPassword, values.currentPassword);
    if (issue) {
      setError(translateValidation(t, PASSWORD_FORM_MESSAGE[issue]) ?? null);
      return;
    }
    if (values.newPassword !== values.confirmPassword) {
      setError(translateApiError(t, "password_mismatch") ?? null);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/auth/password-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        setError(translateApiError(t, data.error ?? "internal_error") ?? null);
        return;
      }
      // The account is unlocked on the server: go to the section this role opens.
      window.location.href = await homeAfterSignIn();
    } catch {
      setError(translateApiError(t, "internal_error") ?? null);
    } finally {
      setIsSaving(false);
    }
  };

  const isIncomplete = !values.currentPassword || !values.newPassword || !values.confirmPassword;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-8">
      <form onSubmit={submit} className="w-full max-w-lg space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{tx.title}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">{isForced ? tx.forcedSubtitle : tx.subtitle}</p>
        </div>

        <PasswordFields
          hasPassword
          values={values}
          showPasswords={showPasswords}
          onChange={(field, value) => {
            // The message belongs to the last attempt: once a field changes it no longer describes the form.
            setError(null);
            setValues((prev) => ({ ...prev, [field]: value }));
          }}
          onToggleShow={() => setShowPasswords((prev) => !prev)}
          description={isForced ? tx.currentIsTemporary : tx.cardDescription}
        />

        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button type="submit" disabled={isSaving || isIncomplete} className="btn-primary text-[color:var(--on-primary)] w-full py-3 min-h-11">
          {tx.submit}
        </button>

        <SignOutButton>
          <LogOut size={16} aria-hidden="true" />
          {t.common.signOut}
        </SignOutButton>
      </form>
    </div>
  );
}
