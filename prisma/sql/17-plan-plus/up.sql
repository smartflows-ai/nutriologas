-- Plus plan (Start / Plus / Pro). Additive only: adds one value to the PlanId enum, no existing row changes.
-- Apply BEFORE deploying the code that writes or reads PLUS (database first, code after).
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql
-- PostgreSQL 12+ allows ADD VALUE inside a transaction; the new value cannot be used until it commits.
ALTER TYPE "PlanId" ADD VALUE IF NOT EXISTS 'PLUS' BEFORE 'PRO';
