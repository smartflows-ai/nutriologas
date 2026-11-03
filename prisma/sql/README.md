# Manual SQL migrations

One folder per change with `up.sql` and `down.sql`. Not run by Prisma: apply by hand, after a verified backup and explicit approval.
Until the project adopts `prisma migrate` (backlog), do not use `db:push` against the real database: it would drop `whatsapp_bot_memory` (n8n bot memory).
