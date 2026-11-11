-- 24-product-price-mode: a price can be fixed, a starting price ("from") or defined after the assessment ("on request").
-- Every existing product defaults to FIXED, so nothing changes until an owner picks another mode.
-- assessmentProductId: the service to book to learn the price of an "on request" service. Plain column (no foreign key):
-- it is checked when saved and again when read, so a deleted or hidden target just stops redirecting.
-- Additive only. Apply BEFORE deploying the code that reads it (database first, code after).
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql
CREATE TYPE "PriceMode" AS ENUM ('FIXED', 'FROM', 'ON_REQUEST');
ALTER TABLE "products"
  ADD COLUMN "priceMode" "PriceMode" NOT NULL DEFAULT 'FIXED',
  ADD COLUMN "assessmentProductId" TEXT;
