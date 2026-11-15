-- 27-appointment-soft-delete (ticket #103): owner and staff delete visits from /admin/citas without erasing them.
-- A deleted visit keeps its row: deletedAt and deletedById say when and who; every read of the app skips it.
-- appointment_trail keeps one row per delete or restore (who, role, when), so a restore never erases who deleted.
-- Additive only: two nullable columns, one new enum, one new table, indexes and foreign keys. Existing rows keep NULL
-- (no visit becomes deleted). Old code ignores all of it, so apply BEFORE deploying the code (database first).
-- Generated with `prisma migrate diff` against a mirror of production; do not edit by hand.
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql

-- CreateEnum
CREATE TYPE "AppointmentTrailAction" AS ENUM ('DELETED', 'RESTORED');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- CreateTable
CREATE TABLE "appointment_trail" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "action" "AppointmentTrailAction" NOT NULL,
    "userId" TEXT,
    "role" "UserRole" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_trail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_trail_tenantId_appointmentId_idx" ON "appointment_trail"("tenantId", "appointmentId");

-- CreateIndex
CREATE INDEX "appointments_tenantId_deletedAt_idx" ON "appointments"("tenantId", "deletedAt");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_trail" ADD CONSTRAINT "appointment_trail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_trail" ADD CONSTRAINT "appointment_trail_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_trail" ADD CONSTRAINT "appointment_trail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
