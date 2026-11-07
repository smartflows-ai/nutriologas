-- STAFF role (ticket #21). Additive only: adds one value to the UserRole enum, no existing row changes.
-- Apply BEFORE deploying the code that reads or writes STAFF (database first, code after).
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql
-- PostgreSQL 12+ allows ADD VALUE inside a transaction; the new value cannot be used until it commits,
-- so this file only adds the value. Creating STAFF users is a separate step (local-utils/create-staff-user.ts).
-- Fail fast instead of queueing behind a long transaction and stalling traffic on "users".
SET LOCAL lock_timeout = '5s';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'STAFF';
