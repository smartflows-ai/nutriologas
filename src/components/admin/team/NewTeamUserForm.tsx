"use client";
// src/components/admin/team/NewTeamUserForm.tsx
// Name and email of a new team member. The server creates the temporary password.
import { useState, type FormEvent } from "react";
import { useTranslation } from "@/i18n";
import { translateApiError } from "@/i18n/validation";
import { useBusinessTimeZone } from "@/components/shared/BusinessTimeZone";
import { buildFullPhone, defaultDialCodeForZone, PHONE_COUNTRIES } from "@/lib/phone";

const NAME_MAX = 80;
const EMAIL_MAX = 254;
const PHONE_MAX = 24;
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
  const zone = useBusinessTimeZone();
  // The business country first (Mexico, +52, by default), like the other phone forms (ticket 120).
  const [dial, setDial] = useState(() => defaultDialCodeForZone(zone));
  const [phone, setPhone] = useState("");
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
        body: JSON.stringify({ name, email, whatsappNumber: buildFullPhone(dial, phone) }),
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

      <div>
        <label htmlFor="team-user-phone" className={LABEL_CLASS}>{tx.phone}</label>
        <div className="flex gap-2">
          <select
            value={dial}
            onChange={(e) => setDial(e.target.value)}
            aria-label={t.booking.countryCode}
            className="input w-28 shrink-0 px-2"
          >
            {PHONE_COUNTRIES.map((c) => (
              <option key={c.iso} value={c.dial}>
                {c.iso} +{c.dial}
              </option>
            ))}
          </select>
          <input
            id="team-user-phone"
            type="tel"
            inputMode="tel"
            required
            maxLength={PHONE_MAX}
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.booking.phonePlaceholder}
            className="input min-w-0"
          />
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tx.phoneHint}</p>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">{tx.createHint}</p>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
        <button type="button" onClick={onCancel} className="btn-ghost min-h-11">
          {t.integrationsUi.cancel}
        </button>
        <button
          type="submit"
          disabled={isSaving || !name.trim() || !email.trim() || !buildFullPhone(dial, phone)}
          className="btn-primary text-[color:var(--on-primary)] min-h-11"
        >
          {tx.create}
        </button>
      </div>
    </form>
  );
}
