"use client";
// src/components/admin/team/NewTeamUserForm.tsx
// Name and email of a new team member. The server creates the temporary password.
import { useState, type FormEvent } from "react";
import { useTranslation } from "@/i18n";
import { translateApiError } from "@/i18n/validation";

const NAME_MAX = 80;
const EMAIL_MAX = 254;
const LABEL_CLASS = "block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1";

interface Props {
  onCreated: (name: string, tempPassword: string) => void;
  onCancel: () => void;
}

export default function NewTeamUserForm({ onCreated, onCancel }: Props) {
  const { t } = useTranslation();
  const tx = t.team;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data: { error?: string; tempPassword?: string; user?: { name?: string | null; email?: string } } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data.tempPassword) {
        setError(translateApiError(t, data.error ?? "internal_error") ?? null);
        return;
      }
      onCreated(data.user?.name || data.user?.email || name, data.tempPassword);
    } catch {
      setError(translateApiError(t, "internal_error") ?? null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="team-user-name" className={LABEL_CLASS}>{tx.name}</label>
          <input
            id="team-user-name"
            required
            maxLength={NAME_MAX}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tx.phName}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="team-user-email" className={LABEL_CLASS}>{tx.email}</label>
          <input
            id="team-user-email"
            type="email"
            required
            maxLength={EMAIL_MAX}
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.auth.phEmail}
            className="input"
          />
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">{tx.createHint}</p>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
        <button type="button" onClick={onCancel} className="btn-ghost min-h-11">
          {t.integrationsUi.cancel}
        </button>
        <button
          type="submit"
          disabled={isSaving || !name.trim() || !email.trim()}
          className="btn-primary text-[color:var(--on-primary)] min-h-11"
        >
          {tx.create}
        </button>
      </div>
    </form>
  );
}
