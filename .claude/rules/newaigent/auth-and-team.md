---
paths:
  - "src/middleware.ts"
  - "src/lib/auth.ts"
  - "src/lib/session.ts"
  - "src/lib/permission*.ts"
  - "src/lib/account-state*.ts"
  - "src/lib/staff-*.ts"
  - "src/lib/password-*.ts"
  - "src/lib/temp-password.ts"
  - "src/lib/sign-in-check.ts"
  - "src/lib/home-after-sign-in.ts"
  - "src/lib/user-limits.ts"
  - "src/lib/team-*.ts"
  - "src/lib/oauth-user.ts"
  - "src/app/*/login/**"
  - "src/app/*/registro/**"
  - "src/app/*/cambiar-contrasena/**"
  - "src/app/*/recuperar/**"
  - "src/app/api/auth/**"
  - "src/app/api/admin/users/**"
  - "src/app/admin/equipo/**"
  - "src/app/admin/layout.tsx"
  - "src/components/admin/team/**"
  - "src/components/admin/SessionWatch.tsx"
---

> Moved from `CLAUDE.md` on 2026-11-20. Loads only when a matching file is read.

## Team: staff users (`/admin/equipo`, ticket #22)

The owner creates, resets, deactivates and activates the staff of the business without the technical team.

- **Screen**: `/admin/equipo` (ADMIN only; server gate `requireAdminPage`, sidebar entry "Equipo", capability `team` on every plan). Components in `src/components/admin/team/`; data and actions in the `useTeam` hook (one action at a time, so a double click cannot reset a password twice).
- **APIs**: `GET/POST /api/admin/users` and `PATCH /api/admin/users/[id]` with `action`: `reset_password`, `deactivate` or `activate`. Guard: permission `users.manage` (`src/lib/permissions.ts`), never granted to STAFF. The business and the actor come from the session only.
- **Rules** (`src/lib/staff-users.ts`, pure, tests in `tests/staff-users.test.ts`; database in `src/lib/staff-users-data.ts`): the screen only acts on STAFF users of the caller's business. The owner's own account, another owner, a customer and a user of another business all answer 404 `user_not_found`. An email already used in the business, with any role, answers 409 `email_already_registered`; the account is never converted. Emails are stored trimmed and in lowercase, as sign-in looks them up.
- **User limit by plan** (`src/lib/user-limits.ts`): Start 1, Plus 2, Pro 3 active CRM users, the owner included, as the landing publishes. Start has no room for staff. A deactivated user does not use a seat; activating checks the limit again. Over the limit: 409 `user_limit_reached`. The count and the write run in one transaction that first locks the business row (`FOR NO KEY UPDATE`), so two requests at once cannot pass the limit. A business that moves to a smaller plan keeps its users and cannot add more.
- **Temporary password** (`src/lib/temp-password.ts`): 14 random characters without look-alikes, created by the server, stored only as a bcrypt hash (cost 12, `src/lib/password-hash.ts`), returned once in the response (`Cache-Control: no-store`) and shown once in `TempPasswordDialog`. Never logged, never kept in browser storage. The owner hands it over outside the system. It does not expire by time.
- **First sign-in**: the user lands on `/cambiar-contrasena` and can open nothing else. `POST /api/auth/password-change` asks for the current (temporary) password and the new one twice, with the shared rules (`passwordIssues`); the new one must differ from the temporary one. The rule lives in `src/lib/password-change.ts` and is shared with the owner's password card (`PATCH /api/tenants/account/password`).
- **Reset**: every open session of that user ends on its next request (`sessionVersion` goes up), the old password stops working, and the next sign-in with the new temporary password forces a change again. **Deactivate**: the user loses access on the next request, cannot sign in (credentials or Google) and gets no `/recuperar` code; activating does not revive the old sessions.
- **`/recuperar`** keeps working for active staff: a successful reset turns `mustChangePassword` off, because the user chose the password and the owner shared the code, and ends every earlier session of that account.
- **Role name** by vertical (`staffTitle`): Asistente, Guía or Personal.
- **Production**: `prisma/sql/23-user-access` is applied (confirmed read-only on 2026-11-18). Steps in `docs/staff-user-production.md`.
- Tests: `tests/staff-users.test.ts`, `staff-users-data.test.ts`, `user-limits.test.ts`, `temp-password.test.ts`, `password-change.test.ts`, `account-state.test.ts`, `sign-in-check.test.ts`, `team-api-wiring.test.ts`, `team-ui-wiring.test.ts`.

---


## Authentication and Authorization

### NextAuth v4
- Providers: `Credentials` (email+password) and `Google`
- The JWT includes custom fields: `id`, `role`, `tenantId`
- The middleware validates the token in the Edge Runtime with `getToken()`

### Middleware redirect flows:
**Live account check (ticket #22):** the token only proves who the user is. On every authenticated request the account row is read (`readAccountAccess` in `src/lib/account-state-data.ts`, rules in `src/lib/account-state.ts`) from the NextAuth `jwt` callback and from `getSessionAccess` / `getAppSession` (`src/lib/session.ts`):
- Deleted or `isActive = false`: no access. Pages go to `/login`, APIs answer 401.
- `sessionVersion` different from the one in the token: no access, for good. The owner reset the password or deactivated the account after that sign-in, so a stolen cookie does not come back when the user chooses a new password or the account is activated again; the user signs in again. A token from before versions existed counts as `0`, so the release signs nobody out.
- `mustChangePassword = true`: pages go to `/cambiar-contrasena`, APIs answer 401; only `POST /api/auth/password-change` and sign-out work.
- Otherwise the role comes from the database, not from the token.

**Host check (ticket #146):** a valid session on the host of another business gets access kind `other_business` (rule in `src/lib/tenant-host-guard.ts`, see `tenant-routing.md`): the session is empty (`{}`), `getSessionAccess` returns `{ kind: "other_business", homeUrl }`, `requireCrmSession` redirects to the session business and `requirePermission` answers 403. `signOut` still works there.

For those two locked cases the session object has **no `user`** (`sessionForAccess`), so every route's `!session?.user` guard rejects it. Always guard with `session?.user`, never with `!session` alone: Prisma ignores a filter whose value is `undefined`, so a route that went on with a missing `tenantId` would read every business. A database error fails closed (no access for that request). Cost: one primary-key read per authenticated request, no cache.

`src/middleware.ts` cannot read the database, so it still trusts the token; the real gate for pages is `requireCrmSession` (admin layout and `requireAdminPage`, `src/lib/permission-guard.ts`). Next.js does not run the layout again on client navigation, so `SessionWatch` (`src/components/admin/SessionWatch.tsx`) asks for the session on every section change and sends a locked user out. Known limits: a user who stays on one screen is only stopped at their next click or API call, and a user demoted from ADMIN to STAFF can still load the empty shell of an owner page (its APIs answer 401); no screen changes roles today.

**Google sign-in is switched off (ticket #151):** the provider in `auth.ts` and the buttons of `/login` and `/registro` are commented out. Only `credentials` exists. Turn it back on only after #151 (business from the host). **Customer sign-up is closed too:** `/registro` (no `page.tsx`: a `notFound()` there answers 200 under the `(auth)` Suspense) and `POST /api/auth/register` answer 404 (form kept in `registro/SignupForm.tsx`); business sign-up (`/api/tenants/register`) and guest accounts made by bookings are unchanged. The owner's Google Calendar connection (`api/apps/oauth/google`) is separate and keeps working.

Sign-in: credentials go through `passwordMatches` (`src/lib/sign-in-check.ts`), which always runs one bcrypt comparison, so an unknown email, a deactivated account and a wrong password answer the same in the same time. Google sign-in is refused for STAFF and for deactivated accounts (`googleSignInAllowed`).

`src/middleware.ts` runs only on `/admin` and `/admin/:path*`:

| Condition | Action |
|---|---|
| `/admin/*` + no session, or a role outside the CRM | Redirect to `/login` |
| `/admin/*` + STAFF on a section it cannot open | Redirect to `/admin`, which sends it to its first section (or an empty screen if it has none) |

Not active (they were in the root `middleware.ts`, which never ran; separate ticket): root domain + tenant route to 404, `/checkout` or `/pedido/*` without login to `/login`, and `/login` or `/registro` with a session to the home page. After a credentials sign-in, the login page sends each role to its home (`src/lib/home-after-sign-in.ts`).

---
