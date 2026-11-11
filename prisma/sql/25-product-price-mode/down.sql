-- Exact reverse of up.sql. Deletes each product's price mode and assessment pointer (only run after the code that reads them is gone).
-- Products set to FROM or ON_REQUEST go back to showing their stored price (0 for on request), so do not run this while any exist.
ALTER TABLE "products"
  DROP COLUMN "assessmentProductId",
  DROP COLUMN "priceMode";
DROP TYPE "PriceMode";
