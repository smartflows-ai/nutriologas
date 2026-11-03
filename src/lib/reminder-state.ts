// src/lib/reminder-state.ts
// The appointment fields written after a reminder succeeds, fails, or the visit is rescheduled.
// Pure functions: each call returns a new object, so the I/O code only has to hand it to Prisma.

export const MAX_ERROR_LENGTH = 300;
const DEFAULT_ERROR = "Envio rechazado";

// Reasons that are safe to keep as written: they name no provider and carry no response body.
const CUSTOMER_SAFE_REASONS = ["WhatsApp no está conectado para este negocio", "Número de teléfono inválido"];
const PROVIDER_STATUS_RE = /\((\d{3})\)/;

/**
 * The stored reason travels to the browser inside appointment rows, so it must follow the white-label rule:
 * no provider name and no raw response body. Known safe texts stay, an HTTP status is kept as a code, and
 * anything else becomes a generic text. The full reason is still logged on the server.
 */
export function safeFailureReason(reason: string): string {
  const text = reason.trim();
  if (CUSTOMER_SAFE_REASONS.includes(text)) return text;
  const status = /evolution api/i.test(text) ? PROVIDER_STATUS_RE.exec(text)?.[1] : undefined;
  return status ? `${DEFAULT_ERROR} (HTTP ${status})` : DEFAULT_ERROR;
}

/** Appointment rows go to the browser; the stored failure reason stays on the server side. */
export function omitReminderError<T extends { reminderLastError?: unknown }>(row: T): Omit<T, "reminderLastError"> {
  const { reminderLastError: _omitted, ...rest } = row;
  return rest;
}

export interface FailureFields {
  reminderAttempts: number;
  reminderLastError: string | null;
  reminderLastAttemptAt: Date | null;
}

const NO_FAILURE: FailureFields = { reminderAttempts: 0, reminderLastError: null, reminderLastAttemptAt: null };

/** A successful send marks the reminder and clears any earlier failure. */
export function sentState(now: Date): { reminderSentAt: Date } & FailureFields {
  return { reminderSentAt: now, ...NO_FAILURE };
}

/** A failed send adds one attempt and keeps a short reason. It never marks the reminder as sent. */
export function failedSendState(previousAttempts: number, reason: string, now: Date): FailureFields {
  return {
    reminderAttempts: previousAttempts + 1,
    reminderLastError: safeFailureReason(reason).slice(0, MAX_ERROR_LENGTH),
    reminderLastAttemptAt: now,
  };
}

/** A new time gets its own reminder and confirmation, and a clean failure history. */
export function rescheduleResetState(): {
  reminderSentAt: null;
  customerConfirmedAt: null;
  autoReleasedAt: null;
} & FailureFields {
  return { reminderSentAt: null, customerConfirmedAt: null, autoReleasedAt: null, ...NO_FAILURE };
}
