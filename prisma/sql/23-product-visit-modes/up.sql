-- 23-product-visit-modes: how each service is delivered (in person, online or both). NULL = follows the business
-- setting (tenants.serviceModes), so every existing service keeps today's behavior.
-- Additive only: one nullable column. Apply BEFORE deploying the code that reads it (database first, code after).
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql
ALTER TABLE "products"
  ADD COLUMN "visitModes" "ServiceModes";
