// src/lib/sign-in-check.ts
// Decides whether a password signs an account in. Pure: the comparison is injected (tests in tests/sign-in-check.test.ts).
// It always runs exactly one comparison. Without that, an unknown or deactivated account would answer faster
// than a wrong password, and the response time would reveal which emails have an account.

// Hash of a random value nobody knows, with the same cost as the stored ones. It only spends the same time.
export const DUMMY_BCRYPT_HASH = "$2b$12$gpHXStMgWli3icakuWwN4uLSNgzqtHinHJSwO0Zs/4bKkT2FF7uZS";

const BCRYPT_PREFIXES = ["$2a$", "$2b$", "$2y$"] as const;

export interface SignInAccount {
  readonly passwordHash: string | null;
  readonly isActive: boolean;
}

type Compare = (plain: string, hash: string) => Promise<boolean>;

// Only a bcrypt hash is accepted: a password stored any other way is never compared.
function usableHash(account: SignInAccount | null): string | null {
  if (!account || !account.isActive || !account.passwordHash) return null;
  return BCRYPT_PREFIXES.some((prefix) => account.passwordHash?.startsWith(prefix)) ? account.passwordHash : null;
}

// `account` is null when no user has that email in the business.
export async function passwordMatches(account: SignInAccount | null, password: string, compare: Compare): Promise<boolean> {
  const hash = usableHash(account);
  const matches = await compare(password, hash ?? DUMMY_BCRYPT_HASH);
  return hash !== null && matches;
}
