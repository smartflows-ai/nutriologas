-- Exact reverse of up.sql. Deletes each service's own delivery setting (only run after the code that reads it is gone).
ALTER TABLE "products"
  DROP COLUMN "visitModes";
