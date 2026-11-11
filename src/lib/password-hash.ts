// src/lib/password-hash.ts
// The one place that hashes and checks CRM passwords, so the cost cannot drift between routes.
// Customer signup (src/app/api/auth/register) keeps its own lower cost on purpose.
import bcrypt from "bcryptjs";

// Higher than customer signup (10): these passwords protect a whole CRM.
export const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
