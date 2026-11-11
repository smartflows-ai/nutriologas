// src/lib/password-change.ts
// A signed-in user changes their own password: the owner's card in the business profile and the forced change
// after a temporary password (ticket #22). One rule for both, so they cannot drift apart.
// Pure logic: the database and bcrypt come in as `deps` (tests in tests/password-change.test.ts).
import { passwordIssues, PASSWORD_API_ERROR } from "./password-rules";

export interface PasswordChangeAccount {
  readonly tenantId: string;
  readonly userId: string;
  // Set for a user that signed in with a temporary password: the current password must always be proven,
  // even if the account somehow has none stored.
  readonly mustProveCurrent?: boolean;
}

export interface PasswordChangeInput {
  // null when the account has no password yet (it signed in with Google).
  readonly currentPassword: string | null;
  readonly newPassword: string;
  readonly confirmPassword: string;
}

export interface PasswordChangeDeps {
  // The stored hash; null when the account has no password; undefined when the user is not in that business.
  findPasswordHash: (tenantId: string, userId: string) => Promise<string | null | undefined>;
  comparePassword: (plain: string, hash: string) => Promise<boolean>;
  hashPassword: (plain: string) => Promise<string>;
  // Stores the hash, turns mustChangePassword off and clears any pending reset code.
  saveOwnPassword: (tenantId: string, userId: string, passwordHash: string) => Promise<void>;
}

export type PasswordChangeFailure =
  | "current_password_required"
  | "current_password_invalid"
  | "password_mismatch"
  | (typeof PASSWORD_API_ERROR)[keyof typeof PASSWORD_API_ERROR];

export type PasswordChangeResult = { readonly ok: true } | { readonly ok: false; readonly reason: PasswordChangeFailure };

const fail = (reason: PasswordChangeFailure): PasswordChangeResult => ({ ok: false, reason });

export async function changeOwnPassword(
  deps: PasswordChangeDeps,
  account: PasswordChangeAccount,
  input: PasswordChangeInput
): Promise<PasswordChangeResult> {
  const storedHash = await deps.findPasswordHash(account.tenantId, account.userId);
  // A user that is not in that business answers like a wrong password: the reply reveals nothing.
  if (storedHash === undefined) return fail("current_password_invalid");
  if (!storedHash && account.mustProveCurrent) return fail("current_password_invalid");

  // An account that already has a password must prove it first. Accounts without one may create it.
  // An empty hash counts as no password, as the owner's card always did; otherwise the account is locked out.
  if (storedHash) {
    if (!input.currentPassword) return fail("current_password_required");
    if (!(await deps.comparePassword(input.currentPassword, storedHash))) return fail("current_password_invalid");
  }

  if (input.newPassword !== input.confirmPassword) return fail("password_mismatch");
  const [issue] = passwordIssues(input.newPassword, input.currentPassword);
  if (issue) return fail(PASSWORD_API_ERROR[issue]);

  await deps.saveOwnPassword(account.tenantId, account.userId, await deps.hashPassword(input.newPassword));
  return { ok: true };
}
