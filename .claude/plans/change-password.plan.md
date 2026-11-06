# Plan: change password for the tenant owner

Branch: feat/change-password (from main). Status: revised after canvas feedback (round 1). Waiting for verdict. No code yet.

## Context

- Login is NextAuth Credentials (`src/lib/auth.ts`, `authorize`). It looks up `User` by email and tenant, accepts only bcrypt hashes (`$2a$`, `$2b$`, `$2y$`) and compares with `bcrypt.compare`.
- `User.passwordHash` is nullable. Accounts created through Google or Outlook sign-in have no password.
- No owner can change a password today. Password forms exist only at login and register (`src/lib/validations/index.ts`, minimum 6 characters).
- The CRM has a sign-out button (`SignOutButton` in `AdminSidebar`) but no account settings page.
- Rate limiting: `rateLimited(key, max, windowMs)` in `src/lib/rate-limit.ts` (in memory, per server instance).

## Scope

An ADMIN (tenant owner) can change their own password from inside the CRM, and can create a password for an account that has none, from the same page. Password creation happens only through this page, never through a Google or Outlook sign-in.

Does NOT do: password reset by email (no mail provider exists), changing another user's password, changing the email, two-factor, and no change to how Google or Outlook sign-in works.

## Decisions (revised from canvas feedback)

1. **Where it lives:** a "Seguridad" (Security) card at the bottom of `/admin/negocio`. Confirmed in the canvas. No new sidebar item.

2. **Accounts without a password:** the card shows "Create a password" and hides the current-password field. This applies only to an ADMIN account whose `passwordHash` is empty, which is the case for accounts created without a password. Password creation is possible only through this page; sign-in with Google or Outlook never sets or reads a password. Open point for the canvas: an owner who signed up with Google and has no password gets the create-password path here. Confirm that this is intended.

3. **Password rules, applied to every new password (change card, register, onboarding):**
   - Minimum **10** characters (recommended over 8: the risk of a short password is higher here because there is no reset by email). Maximum **72** (bcrypt truncates beyond that).
   - No forced composition rules (no "one symbol" rule). Length matters more, and forced rules push people to predictable patterns (NIST SP 800-63B).
   - Reject the new password if it equals the current one, and reject a short list of the most common passwords (about 100 entries in `src/lib/password-rules.ts`). A full breach-list check (HaveIBeenPwned) is a later option; it needs an outbound request.
   - Allow paste in every password field (no `onPaste` blocking).
   - Show a strength hint in the card (length-based, no fake score). Show/hide toggle with `aria-label`.
   - **Login keeps accepting any existing password** (min 6 stays for login), so no current user is locked out. The new rules apply only when a password is set or changed.
   - Register and onboarding (`/api/auth/register`, `/api/tenants/register`, `src/lib/validations/index.ts`) move to the same rules: minimum 10.

4. **Other signed-in sessions:** recommendation is to **add the session check now**. NextAuth uses JWT sessions, so a changed password does not stop a stolen session. Plan:
   - Add a nullable column `User.passwordChangedAt` through a manual SQL change (`prisma/sql/19-password-changed-at/`, additive, `up.sql` and `down.sql`). Needs a verified backup and your approval before it is applied to production.
   - Store the token's issue time (`iat`) in the JWT.
   - Check, in the session read used by the admin layout and the protected APIs (not on every auth callback, to limit database reads), that `iat` is later than `passwordChangedAt`. If not, the session is treated as signed out.
   - Cost: one indexed read of the user's row per admin request. Acceptable for the CRM.
   - Alternative (accept and document) is cheaper but leaves stolen sessions valid for the JWT lifetime. Not recommended for an account that holds patient and customer data.

5. **After success:** the current session stays valid for the owner who changed the password (their own `iat` is set so they are not signed out), success message, fields cleared.

6. **Rate limit:** 5 wrong current-password attempts per 15 minutes per user id (not IP). In memory, so it is not exact across server instances.

## Steps

1. **Pure rules (test first):** `src/lib/password-rules.ts`
   - `validateNewPassword(value, current?)`: length 10 to 72, not in the common list, not equal to the current password.
   - `passwordChangeSchema` (zod): `currentPassword` optional (the route requires it when a hash exists), `newPassword`, `confirmPassword` must match.
   - Use the same rules module from register and onboarding.
   - Test file: `local-utils/password-rules.test.ts` (node:test, `npx tsx --test`).
2. **Schema (after approval):** `prisma/sql/19-password-changed-at/{up,down}.sql`, `ALTER TABLE "users" ADD COLUMN "passwordChangedAt" TIMESTAMP(3)` (nullable, additive). Tested on a throwaway local PostgreSQL 18 (up, down, up), backup first, applied after approval. Database first, then code.
3. **Session check:** token stores `iat`; the session helper (`src/lib/session.ts`) compares it with `passwordChangedAt`. Sessions older than the change are rejected.
4. **API:** `src/app/api/tenants/account/password/route.ts`, `PATCH`.
   - `getAppSession()`; 401 if no session or role is not `ADMIN`.
   - `userId` from the session, never from input. Lookup `prisma.user.findFirst({ where: { id, tenantId } })`.
   - Rate limit check first (429 `too_many_attempts`).
   - If `passwordHash` exists: `bcrypt.compare(currentPassword)`; wrong gives 400 `current_password_invalid`.
   - Hash with `bcrypt.hash(newPassword, 12)`, save `passwordHash` and `passwordChangedAt = now`.
   - Errors use `apiError` keys, plus the new ones above. Never log the password or the hash.
5. **UI:** `src/components/admin/ChangePasswordCard.tsx`, rendered at the bottom of `src/app/admin/negocio/page.tsx`.
   - Tenant theme tokens only, minimal-ui style (rules in `local-utils/minimal-ui/config.js`, audit with `node local-utils/minimal-ui/audit.js`). No hardcoded colors, no emojis, lucide icons with size and strokeWidth.
   - `autoComplete="current-password"` / `"new-password"`, show/hide toggle with `aria-label`.
   - Inline errors; success through `useToast`.
   - Check: empty, long, dark mode, light and dark tenant colors.
6. **Register and onboarding:** move `src/lib/validations/index.ts` and the two register routes to the shared rules (minimum 10). Update the form hints in `/registro` and `OnboardingModal.tsx`.
7. **i18n:** keys under `crm.business.security.*` and the register hint, in `types.ts`, `es.ts`, `en.ts`.
8. **Checks:** `npx tsc --noEmit`, `npx tsx --test local-utils/*.test.ts`, `npm run build` (zero errors per CLAUDE.md).
9. **Review:** `/ecc:code-review`, plus `security-reviewer` (auth code). Then `/ecc:pr`.
10. **Browser check (manual, not done here):** owner changes password, other session is signed out, new password works, old one fails, Google-only test account creates a password, register with a 9-character password is rejected. Test tenant only; screenshots outside the repo.

## Files that change

- New: `src/lib/password-rules.ts`, `src/app/api/tenants/account/password/route.ts`, `src/components/admin/ChangePasswordCard.tsx`, `local-utils/password-rules.test.ts`, `prisma/sql/19-password-changed-at/up.sql` and `down.sql`
- Changed: `src/app/admin/negocio/page.tsx`, `src/lib/session.ts`, `src/lib/auth.ts` (store `iat`), `src/lib/validations/index.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/tenants/register/route.ts`, `src/components/marketing/OnboardingModal.tsx`, `src/app/(auth)/registro/page.tsx`, `src/i18n/types.ts`, `src/i18n/es.ts`, `src/i18n/en.ts`, `prisma/schema.prisma` (`passwordChangedAt`)

## Risks

- **Schema change needs approval.** The new column is additive and nullable, but CLAUDE.md requires a verified backup, a tested up and down, your approval, and the database applied before the code.
- **Session check adds a read per admin request.** Small and indexed by user id; watch it in production.
- **Rate limit is per server instance.** Not an exact limit, but it stops casual guessing from the card.
- **Stricter rules on register** can lower sign-ups. Mitigation: the hint shows the rule before the user types.
- **Lockout if the new password is forgotten:** no reset by email. Say so in the card's copy.

## Verification

- Unit tests for the pure rules: length 9 rejected, 10 accepted, 72 accepted, 73 rejected, common password rejected, same as current rejected, confirm mismatch rejected.
- Manual: wrong current password (400), correct one (200, new login works), 5 wrong tries (429), non-admin (401), Google-only test account (creates a password without the current one), old session rejected after change.
- `npm run build` passes.

## Open questions

1. Confirm: an owner who signed up with Google and has no password gets the create-password path on this card (point 2). Yes or no?
2. Approve the schema change (`passwordChangedAt`) when we reach step 2.
