---
paths:
  - "prisma/**"
---

> Moved from `CLAUDE.md` on 2026-11-20. Loads only when a matching file is read.

### Schema changes (manual SQL, up and down)

`npm run db:push` compares the **whole** `schema.prisma` with the real database and applies every difference. The real database has a table that belongs to n8n, `whatsapp_bot_memory` (the WhatsApp agent's conversation memory). It is declared in `schema.prisma` as `WhatsappBotMemory` only so Prisma knows it exists (since 2026-11-10); never remove that model, and never add columns or relations to it: without it `db:push` would **drop the table** and the bot would lose its memory. The project has no migration history yet (`prisma migrate` adoption is a separate task), so a schema change goes as a folder in `prisma/sql/<change>/` with:
- `up.sql`: additive when possible (new nullable columns or columns with a default), so the old code keeps working until the new code is deployed.
- `down.sql`: the exact reverse. Written by hand (Prisma does not generate it). It deletes the data held in what it removes, so it runs only to undo the change and after the code that reads it is gone.

How to make one safely:
1. Add the fields to `schema.prisma` and write both files.
2. Verify on a throwaway local PostgreSQL (same major version as production): load the schema-only dump, then compare with `DIFF_URL=<url> npx prisma migrate diff --config local-utils/prisma-diff.config.ts --from-config-datasource --to-schema prisma/schema.prisma --script` before `up.sql` (only your change shows), after `up.sql` (nothing about your change) and after `down.sql` (your change shows again). Nothing else should show: the diff is expected to be empty.
3. Take a verified backup first (`pg_dump` of the same major version, custom format, stored **outside the repo** with owner-only permissions; it holds personal data), and a fresh one right before applying. `pg_dump` refuses a server newer than itself.
4. Get explicit human approval, then apply `up.sql` in one transaction (`psql -v ON_ERROR_STOP=1 -1 -f up.sql`) and verify types, defaults and that existing rows did not change.
5. **Order: database first, code after.** New code reads the new columns; if it ships first, every appointment query fails (reminders, agenda, bot, CRM). Old code ignores extra columns, so the reverse is safe. Merging to `main` deploys through CI/CD, so a merge counts as a deploy.


---
