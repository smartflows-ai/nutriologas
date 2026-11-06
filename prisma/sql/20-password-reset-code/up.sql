-- 20-password-reset-code: columns for the owner's WhatsApp reset code.
-- Additive: nullable columns and a counter with a default, so the old code keeps working.
ALTER TABLE "users"
  ADD COLUMN "passwordResetCodeHash" TEXT,
  ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3),
  ADD COLUMN "passwordResetAttempts" INTEGER NOT NULL DEFAULT 0;
