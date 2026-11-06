-- Exact reverse of up.sql. Deletes any pending reset code (only run after the code that reads it is gone).
ALTER TABLE "users"
  DROP COLUMN "passwordResetAttempts",
  DROP COLUMN "passwordResetExpiresAt",
  DROP COLUMN "passwordResetCodeHash";
