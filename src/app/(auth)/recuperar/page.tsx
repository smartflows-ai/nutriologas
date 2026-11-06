"use client";
// Owner password reset on one page: 1) the email, 2) the 6-digit code from WhatsApp and the new password.
import { useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n";
import { translateApiError, translateValidation } from "@/i18n/validation";
import { passwordIssues, PASSWORD_FORM_MESSAGE } from "@/lib/password-rules";

const CODE_LENGTH = 6;
const EMPTY_DIGITS = Array.from({ length: CODE_LENGTH }, () => "");

type Step = "email" | "code";

export default function RecoverPasswordPage() {
  const { t } = useTranslation();
  const tx = t.passwordRecovery;
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(EMPTY_DIGITS);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("");
  const needsNewCode = errorCode === "reset_code_expired" || errorCode === "reset_code_attempts_used";
  const inputType = showPasswords ? "text" : "password";

  const failWith = (data: { error?: string }) => {
    setErrorCode(data.error ?? null);
    setError(translateApiError(t, data.error) ?? null);
  };

  const sendCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        failWith(await res.json().catch(() => ({})));
        return;
      }
      setDigits(EMPTY_DIGITS);
      setStep("code");
      setTimeout(() => boxes.current[0]?.focus(), 0);
    } catch {
      setError(translateApiError(t, "internal_error") ?? null);
    } finally {
      setLoading(false);
    }
  };

  // Typing fills the box and moves on; a single digit replaces what was there.
  const typeDigit = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setDigits((prev) => prev.map((d, i) => (i === index ? digit : d)));
    if (digit && index < CODE_LENGTH - 1) boxes.current[index + 1]?.focus();
  };

  // Pasting "482915" anywhere fills all six boxes.
  const pasteCode = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    setDigits((prev) => prev.map((d, i) => (i >= index && i - index < pasted.length ? pasted[i - index] : d)));
    boxes.current[Math.min(index + pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  const onBoxKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      boxes.current[index - 1]?.focus();
    }
  };

  const resetCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);

    // The same rules the server applies; the first problem is shown.
    const [issue] = passwordIssues(newPassword, null);
    if (issue) {
      setError(translateValidation(t, PASSWORD_FORM_MESSAGE[issue]) ?? null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword, confirmPassword }),
      });
      if (!res.ok) {
        failWith(await res.json().catch(() => ({})));
        return;
      }
      router.push("/login?reset=1");
    } catch {
      setError(translateApiError(t, "internal_error") ?? null);
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setStep("email");
    setDigits(EMPTY_DIGITS);
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setErrorCode(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2 text-center">{tx.title}</h1>

        {step === "email" ? (
          <form onSubmit={sendCode} className="space-y-6">
            <p className="text-gray-500 text-sm text-center">{tx.requestSubtitle}</p>

            <div>
              <label htmlFor="recover-email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                {t.auth.emailLabel}
              </label>
              <input
                id="recover-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder={t.auth.phEmail}
              />
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button type="submit" disabled={loading || !email} className="btn-primary w-full py-3">
              {tx.sendCode}
            </button>

            <Link href="/login" className="block text-center text-sm text-primary hover:underline">
              {tx.backToLogin}
            </Link>
          </form>
        ) : (
          <form onSubmit={resetCode} className="space-y-6" autoComplete="off">
            <p className="text-gray-500 text-sm text-center">{tx.requestSent}</p>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 text-center">{tx.codeLabel}</p>
              <div className="flex justify-center gap-2">
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      boxes.current[index] = el;
                    }}
                    aria-label={`${tx.codeLabel} ${index + 1}`}
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    value={digit}
                    onChange={(e) => typeDigit(index, e.target.value)}
                    onKeyDown={(e) => onBoxKeyDown(index, e)}
                    onPaste={(e) => pasteCode(index, e)}
                    onFocus={(e) => e.currentTarget.select()}
                    className="input w-11 h-12 p-0 text-center text-lg font-semibold"
                  />
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="reset-new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                {tx.newPassword}
              </label>
              <input
                id="reset-new-password"
                type={inputType}
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{tx.hint}</p>
            </div>

            <div>
              <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                {tx.confirmPassword}
              </label>
              <input
                id="reset-confirm-password"
                type={inputType}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                className="accent-primary"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
              />
              {t.crm.business.security.showPassword}
            </label>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button type="submit" disabled={loading || code.length !== CODE_LENGTH} className="btn-primary w-full py-3">
              {tx.submit}
            </button>

            {needsNewCode ? (
              <button type="button" onClick={startOver} className="block w-full text-center text-sm text-primary hover:underline">
                {tx.requestAgain}
              </button>
            ) : (
              <button type="button" onClick={startOver} className="block w-full text-center text-sm text-gray-500 dark:text-gray-400 hover:underline">
                {tx.backToLogin}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
