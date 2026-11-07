// src/lib/password-reset.ts
// Owner password reset with a one-time WhatsApp code. Pure logic: the database, the sender and the clock
// come in as `deps`, so the rules are tested without them (local-utils/password-reset.test.ts).
import { checkResetCode, generateResetCode, hashResetCode, RESET_CODE_TTL_MS } from "@/lib/password-reset-code";
import { passwordIssues, PASSWORD_API_ERROR } from "@/lib/password-rules";

export interface ResetUser {
  id: string;
  email: string;
  passwordHash: string | null;
  passwordResetCodeHash: string | null;
  passwordResetExpiresAt: Date | null;
  passwordResetAttempts: number;
}

export interface ResetTenant {
  id: string;
  name: string;
  whatsappNumber: string | null;
  messageLanguage: "es" | "en";
}

export interface ResetDeps {
  // Only ADMIN accounts of this tenant (the caller filters by tenant and role).
  findAdminByEmail: (tenantId: string, email: string) => Promise<ResetUser | null>;
  findTenant: (tenantId: string) => Promise<ResetTenant | null>;
  saveResetCode: (userId: string, codeHash: string, expiresAt: Date) => Promise<void>;
  bumpAttempts: (userId: string) => Promise<void>;
  // Stores the new password hash and clears the reset fields, so a code works once.
  saveNewPassword: (userId: string, passwordHash: string) => Promise<void>;
  // Sends the message from the platform line to the given number.
  sendCode: (to: string, text: string) => Promise<{ success: boolean }>;
  hashPassword: (password: string) => Promise<string>;
  generateCode: () => string;
  secret: string;
  now: () => Date;
}

export type RequestResult = "sent" | "no_account" | "no_destination" | "send_failed";

export type ConfirmFailure =
  | "wrong_code"
  | "expired"
  | "too_many_attempts"
  | "password_mismatch"
  | "password_too_short"
  | "password_too_long"
  | "password_common"
  | "password_same_as_current";

export type ConfirmResult = { ok: true } | { ok: false; reason: ConfirmFailure };

// WhatsApp bold is *text*. Characters that would break it are removed from the business name.
export function resetMessage(tenant: Pick<ResetTenant, "name" | "messageLanguage">, code: string): string {
  const name = tenant.name.replace(/[*_~`]/g, "").trim();
  const minutes = Math.round(RESET_CODE_TTL_MS / 60_000);
  if (tenant.messageLanguage === "en") {
    return [
      `Hi, I'm *Newy*, the AI assistant of *NewAigent*.`,
      ``,
      `Here is your code to reset the password for *${name}*:`,
      ``,
      `*${code}*`,
      ``,
      `It expires in *${minutes} minutes*. If you did not ask for it, you can ignore this message.`,
    ].join("\n");
  }
  return [
    `Hola, soy *Newy*, el asistente de IA de *NewAigent*.`,
    ``,
    `Aquí tienes tu código para restablecer la contraseña de *${name}*:`,
    ``,
    `*${code}*`,
    ``,
    `Vence en *${minutes} minutos*. Si no lo pediste, puedes ignorar este mensaje.`,
  ].join("\n");
}

// Asks for a code. The caller always answers the same way; the result is for logs only, so the reply
// never shows whether the email exists.
export async function requestResetCode(deps: ResetDeps, tenantId: string, email: string): Promise<RequestResult> {
  const user = await deps.findAdminByEmail(tenantId, email);
  if (!user) return "no_account";

  const tenant = await deps.findTenant(tenantId);
  if (!tenant?.whatsappNumber) return "no_destination";

  const code = deps.generateCode();
  const expiresAt = new Date(deps.now().getTime() + RESET_CODE_TTL_MS);
  await deps.saveResetCode(user.id, hashResetCode(code, deps.secret), expiresAt);

  const sent = await deps.sendCode(tenant.whatsappNumber, resetMessage(tenant, code));
  return sent.success ? "sent" : "send_failed";
}

// Checks the code, then sets the new password under the shared rules.
export async function confirmResetCode(
  deps: ResetDeps,
  tenantId: string,
  email: string,
  code: string,
  newPassword: string,
  confirmPassword: string
): Promise<ConfirmResult> {
  const user = await deps.findAdminByEmail(tenantId, email);
  // An unknown email answers like a wrong code, so the reply does not reveal accounts.
  if (!user) return { ok: false, reason: "wrong_code" };

  const check = checkResetCode({
    storedHash: user.passwordResetCodeHash,
    expiresAt: user.passwordResetExpiresAt,
    attempts: user.passwordResetAttempts,
    code,
    secret: deps.secret,
    now: deps.now(),
  });
  if (!check.ok) {
    // No code was ever requested: answered like a wrong code, without counting an attempt.
    if (check.reason === "no_code") return { ok: false, reason: "wrong_code" };
    if (check.reason === "wrong_code") {
      await deps.bumpAttempts(user.id);
      return { ok: false, reason: "wrong_code" };
    }
    return { ok: false, reason: check.reason };
  }

  if (newPassword !== confirmPassword) return { ok: false, reason: "password_mismatch" };
  const [issue] = passwordIssues(newPassword, null);
  if (issue) return { ok: false, reason: PASSWORD_API_ERROR[issue] };

  await deps.saveNewPassword(user.id, await deps.hashPassword(newPassword));
  return { ok: true };
}
