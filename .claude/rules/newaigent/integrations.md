---
paths:
  - "src/lib/microsoft-calendar.ts"
  - "src/lib/google-calendar.ts"
  - "src/lib/calendar-*.ts"
  - "src/lib/external-calendar.ts"
  - "src/lib/cloudinary*.ts"
  - "src/app/api/apps/**"
  - "src/app/api/upload/**"
  - "src/app/admin/apps/**"
---

> Moved from `CLAUDE.md` on 2026-11-20. Loads only when a matching file is read.

## Meta Integration (Facebook & Instagram)

- **Unified OAuth**: Connects Facebook Pages and Instagram Professional Accounts through Meta's OAuth flow (`/api/apps/oauth/facebook/start` and `/callback`).
- **Required scopes**: `email`, `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`.
- **Strict Instagram Professional requirement**: The Meta Graph API **blocks personal Instagram accounts** from publishing via API. The user must:
  1. Switch the Instagram account to a Professional account (Business or Creator).
  2. Link the Instagram account to their Facebook Page in Meta Business Suite.
  3. Reconnect Meta from `/admin/apps` to associate the `igBusinessAccountId`.
- **Automatic publishing with n8n**: The workflow publishes directly to Facebook (`POST /{pageId}/photos`) and Instagram (`POST /{igUserId}/media` -> `POST /{igUserId}/media_publish`).

---

## Microsoft Integration (Outlook Calendar)

- **OAuth flow**: `/api/apps/oauth/microsoft/start` and `/callback` — analogous to the Google flow.
- **Provider enum**: `MICROSOFT` in Prisma's `AppProvider`.
- **Sidebar**: The `/admin/calendario` route requires `providersReq: ["GOOGLE", "MICROSOFT"]` — it is shown if either of the two is connected.
- **Env vars**: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` (use `"common"` for multi-tenant).
- **Event writing**: the scope is `Calendars.ReadWrite` (start, callback and refresh). Earlier connections are read-only and must be reconnected; `/admin/apps` shows a notice when the scope is missing. Graph calls live in `src/lib/microsoft-calendar.ts`.

---


## Cloudinary Folders

- Single account; the root folder is `newaigent` (constant `CLOUDINARY_ROOT_FOLDER` in `src/lib/cloudinary-root.ts`). Everything belonging to a business lives in `newaigent/<tenantId>/<type>`: `logo`, `products`, `carousel`, `campaigns` and `temp` (the banner's temporary overlay).
- The signup logo is sent together with the form (multipart: `payload` and `logo`) and `POST /api/tenants/register` uploads it to `newaigent/<tenantId>/logo` after creating the business. There is no `signups` folder; `POST /api/upload/public` was removed.
- `render-post-banner` requires `tenantId` (400 if missing). One-off scripts: `local-utils/rename-cloudinary-root.ts` (renamed `nutriologas` to `newaigent`) and `local-utils/remove-cloudinary-signups.ts`.
- Renaming a folder in Cloudinary changes the URLs of everything it contains: any URL stored in the database stops working.
