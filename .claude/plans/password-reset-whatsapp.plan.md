# Plan: reset the owner's password with a WhatsApp code (revision 2)

Status: re-planning. Revision 1 was approved on the canvas; this revision changes the test number and the work already done. Waiting for the new verdict. No new code until then.

## Done since approval (revision 1)

- `src/lib/password-reset-code.ts` and `local-utils/password-reset-code.test.ts`: code generation, HMAC hashing, check order (no code, too many attempts, expired, wrong code). 11 tests pass; type check clean.
- Migration `prisma/sql/20-password-reset-code/` (three additive columns on `users`): tested on a throwaway PostgreSQL 18 (up, down, up, user rows checksum unchanged) and **applied to production** on 2026-11-05 after a verified backup (`C:\Users\irvin\db-backups\full-20261105-225655.dump`). Production is PostgreSQL 17.6; the test used 18 (no 17 installed locally).
- `prisma/schema.prisma` is NOT updated yet. The fields go in with the routes, because Prisma would fail on queries if the field is declared without the column. The column exists now, so this is safe to do in the next step.

## Context

- Owners sign in with email and password on the business subdomain (`src/lib/auth.ts`, Credentials).
- No email sending exists yet. Provider decision pending (`no-reply@newaigent.com` created).
- `sendWhatsAppMessage` (`src/lib/whatsapp.ts`) sends through the tenant's own Evolution connection to a given number. `notifyTenantOwner` sends to `Tenant.whatsappNumber`.
- The change-password card (`PATCH /api/tenants/account/password`) needs a logged-in session.

## Scope

An ADMIN owner who forgot the password asks for a code on the login page. The code goes by WhatsApp to the destination number (decision 1 below). The owner enters the code and sets a new password with the shared rules.

Does NOT do: email reset, CUSTOMER accounts, Google-only accounts (they keep Google sign-in), changing the phone number, two-factor.

## Decisions

1. **Destination number.** The code is sent only to a number stored on the tenant, never one typed by the user. Two candidates:
   - (a) `Tenant.whatsappNumber` (what `notifyTenantOwner` uses today). Open risk: if that number is the business line connected to the same WhatsApp instance, the message would be a self-message and may never reach a person.
   - (b) A dedicated reset number on the owner's account, set in `/admin/negocio` and verified before use. Cleaner and reaches the owner's own phone, but it needs a new field and a verification step (another code sent to that number).
   - (c) **A platform sender:** NewAigent's own WhatsApp line (company number, added by you as an env setting, not a tenant). The code goes from that line to the owner's number on record. No tenant bot involved, so no self-message risk and no dependency on each tenant's connection. The message is about the NewAigent account, so it can say NewAigent (brand rule for a platform-level message). Needs: a separate Evolution instance for the company line (you scan its QR), an env variable with its instance name, a send path that does not depend on `tenantId`, and the same digit rule so the owner's number cannot equal the company line.
   - **Recommendation:** (c) for reset codes, because it is the company's own line, not shared with any tenant's bot, and it works when a tenant's connection is down. (b) remains if you want the code to go to a number the owner chooses. Platform instance name (given 2026-11-06): `NewAigent-bot`. Read-only check: no tenant uses this name. It goes in an env variable (for example `PLATFORM_WA_INSTANCE`), not in code.

Finding (2026-11-06): the company number 81 1181 3540 is already the WhatsApp line of doctorg's bot (doctorg.localhost). So (c) needs a different, unused line for the platform sender. Using this one would take it away from doctorg's bot. Option (c) is still possible with a new, independent line: the user will prepare a separate number for the platform sender. doctorg's bot line stays as it is.
   - Until decided: no real message is sent to any number.
2. **Test number.** Real sends need your approval and a number you control (CLAUDE.md). Proposal: your own phone for the first send, after approval.
3. **Who gets a code:** only ADMIN accounts.
4. **Request form:** `/login` gets a "Forgot password?" link to `/recuperar`. It asks for the owner's email. The reply is the same whether or not the email exists.
5. **Code:** 6 digits, valid 10 minutes, single use, only the HMAC hash stored (done in `password-reset-code.ts`).
6. **Limits:** 3 requests per 15 minutes per email and per tenant. 5 wrong codes voids the code. `rateLimited` is in memory per instance; the attempt counter is in the database, so brute force stays capped.
7. **After reset:** the owner signs in again with the new password (no automatic sign-in). Other sessions stay valid unless the session check (`passwordChangedAt`, still pending) ships with this feature. Recommended: ship it together.
8. **Message:** short, in the tenant's language, business name and code, says it expires and to ignore it if not requested. No provider or technical terms.
9. **WhatsApp down or not connected:** the page says the code could not be sent and points to info@newaigent.com. Nothing changes in the account.
10. **The owner number and the bot line must differ (new rule).** Today nothing checks it: `/admin/negocio` saves `Tenant.whatsappNumber` with no comparison, and the WhatsApp connection (`/api/apps/whatsapp/status`, the QR scan) stores `waPhoneNumber` with no comparison. Both are checked at the server:
    - Compare digits only (the same phone can be stored with or without `+`, spaces or dashes). Mexican mobile numbers may appear as `52` + 10 digits or `521` + 10 digits; treat them as the same number.
    - Business save: reject a `whatsappNumber` equal to the connected line, error key `owner_number_is_bot_line`.
    - WhatsApp connection: when the scanned line equals `Tenant.whatsappNumber`, do not keep the connection; error key `bot_line_is_owner_number`. Tell the owner to use a different number for the bot, or change the owner number first.
    - Existing data: checked read-only on 2026-11-06, the two tenants (doctorg, elfar) already differ. Nothing to fix now.
    - UI: `/admin/negocio` labels the field as the number where the owner receives alerts and codes, and the WhatsApp page shows the bot line separately, so the two are not confused. Text in es and en.
    - Tests: pure comparison rule in `src/lib/whatsapp-number.ts` with node:test cases (same number with and without `+`, `52` vs `521`, different numbers).
    - Both routes call the same rule, so the check cannot be skipped in one place.

## Steps

1. Schema fields in `prisma/schema.prisma` on `User` (`passwordResetCodeHash`, `passwordResetExpiresAt`, `passwordResetAttempts`). Done with step 3, after `npx prisma generate` locally.
2. **If decision 1(b):** `Tenant` or `User` gets a reset-number field, a setting in `/admin/negocio`, and a verification code flow. Add a small test for the rules. Own migration (`prisma/sql/21-…`), backup and approval first.
3. **API:**
   - `POST /api/auth/password-reset/request` `{ email }`: always `200 { ok: true }` unless rate limited (429). Finds the ADMIN in this tenant; if found and a destination exists, stores the hash and sends the code.
   - `POST /api/auth/password-reset/confirm` `{ email, code, newPassword, confirmPassword }`: checks code, expiry and attempts; `passwordIssues` on the new password; stores the new hash; clears the reset fields.
   - Errors use `apiError` keys added to `src/i18n`.
4. **Pages:** `src/app/(auth)/recuperar/page.tsx` and `src/app/(auth)/recuperar/codigo/page.tsx`, plus the link on `/login`. Theme tokens, minimal-ui style, no emojis, lucide icons.
5. **i18n:** keys in `types.ts`, `es.ts`, `en.ts`.
6. **Checks:** `npx tsc --noEmit`, `npx tsx --test local-utils/*.test.ts`, minimal-ui audit. `npm run build` before review, with the dev server stopped (shared `.next`).
7. **Review:** `/ecc:code-review` plus `security-reviewer`. Then `/ecc:pr`.
8. **Local test first:** against a throwaway local database (never the production one) with the dev server pointed at it, and a stubbed WhatsApp send that prints the code. Covers every case: wrong code 5 times, expired, correct code, login with the new password, old password fails, unknown email gives the same reply, no destination gives a clear message.
9. **One real send:** only after your approval, to the number you choose in decision 2.

## Files that change

- New: `src/app/api/auth/password-reset/request/route.ts`, `src/app/api/auth/password-reset/confirm/route.ts`, the two pages, and step 2's files if decision 1(b).
- Changed: `prisma/schema.prisma` (three fields on `User`), `src/app/(auth)/login/page.tsx` (link), `src/i18n/types.ts`, `src/i18n/es.ts`, `src/i18n/en.ts`.

## Risks

- **Self-message to the business line** (decision 1a). Avoided by 1b; if 1a is kept, it must be tested on a real tenant first.
- **WhatsApp connection down** means no reset. The fallback is the manual support path.
- **Schema drift until the code ships:** the columns exist in production, the Prisma schema does not know them yet. Nothing reads them until the routes ship, so no harm; it must be closed in step 1.
- **Owner's number changed:** the code goes to the old number. Fix it in `/admin/negocio` first, or support fixes it.

## Open questions

1. Decision 1: (a) use the business number on record, or (b) a dedicated reset number verified by the owner? (Recommended: b.)
2. Which number receives the first real test message? Your own phone, approved explicitly.
3. Ship the `passwordChangedAt` session check together with this feature? (Recommended: yes.)
