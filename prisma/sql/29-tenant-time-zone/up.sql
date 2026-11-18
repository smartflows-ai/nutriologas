-- 29-tenant-time-zone (ticket #111): each business has its own time zone (IANA name, for example America/Cancun).
-- Hours, free times, reminders, the bot and the calendar read and write wall-clock times in this zone.
-- timeZoneSource says who set it: 'default' (never set), 'google' (detected from the address) or 'manual' (the owner).
-- Additive only: both columns have a default, so every existing business keeps Mexico City time, as today.
-- Apply BEFORE deploying the code that reads it (database first, code after).
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql
ALTER TABLE "tenants" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'America/Mexico_City';

ALTER TABLE "tenants" ADD COLUMN "timeZoneSource" TEXT NOT NULL DEFAULT 'default';
