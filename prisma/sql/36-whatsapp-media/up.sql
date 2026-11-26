-- 36-whatsapp-media (ticket #182): WhatsApp files the panel shows for 30 days, from the patient and from the business.
-- whatsapp_media keeps one row per file (kind, status, size, dates, who hid it); the copy lives in a private store
-- under <tenantId>/<id> and is destroyed on its 30th day or when its chat is deleted. The row stays, without the
-- person's data (caption and file name are cleared). whatsapp_media_trail keeps one row per hide or restore.
-- Additive only: three new enums, two new tables, indexes and foreign keys. No existing table or row changes, and
-- the old code never reads these tables, so apply BEFORE deploying the code (database first).
-- The first block is generated with `prisma migrate diff` from the schema of main to the schema of this change; do
-- not edit it by hand. The last block (row level security) is written by hand: prisma migrate diff does not see it.
-- Run in one transaction: psql -v ON_ERROR_STOP=1 -1 -f up.sql
-- CreateEnum
CREATE TYPE "WhatsAppMediaKind" AS ENUM ('IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'STICKER');

-- CreateEnum
CREATE TYPE "WhatsAppMediaStatus" AS ENUM ('PENDING', 'STORED', 'TOO_LARGE', 'SIZE_UNKNOWN', 'CONTACT_LIMIT', 'TENANT_LIMIT', 'VIEW_ONCE', 'FAILED', 'DESTROYED');

-- CreateEnum
CREATE TYPE "WhatsAppMediaTrailAction" AS ENUM ('HIDDEN', 'RESTORED');

-- CreateTable
CREATE TABLE "whatsapp_media" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" TEXT,
    "messageId" TEXT,
    "keyId" TEXT NOT NULL,
    "fromMe" BOOLEAN NOT NULL,
    "kind" "WhatsAppMediaKind" NOT NULL,
    "status" "WhatsAppMediaStatus" NOT NULL DEFAULT 'PENDING',
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" BIGINT,
    "caption" TEXT,
    "storagePath" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "destroyAfter" TIMESTAMP(3) NOT NULL,
    "destroyRequestedAt" TIMESTAMP(3),
    "destroyedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),
    "hiddenById" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_media_trail" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "action" "WhatsAppMediaTrailAction" NOT NULL,
    "userId" TEXT,
    "role" "UserRole" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_media_trail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_media_messageId_key" ON "whatsapp_media"("messageId");

-- CreateIndex
CREATE INDEX "whatsapp_media_tenantId_chatId_receivedAt_idx" ON "whatsapp_media"("tenantId", "chatId", "receivedAt");

-- CreateIndex
CREATE INDEX "whatsapp_media_destroyedAt_destroyAfter_idx" ON "whatsapp_media"("destroyedAt", "destroyAfter");

-- CreateIndex
CREATE INDEX "whatsapp_media_tenantId_status_idx" ON "whatsapp_media"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_media_tenantId_keyId_key" ON "whatsapp_media"("tenantId", "keyId");

-- CreateIndex
CREATE INDEX "whatsapp_media_trail_tenantId_mediaId_idx" ON "whatsapp_media_trail"("tenantId", "mediaId");

-- AddForeignKey
ALTER TABLE "whatsapp_media" ADD CONSTRAINT "whatsapp_media_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_media" ADD CONSTRAINT "whatsapp_media_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "whatsapp_chats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_media" ADD CONSTRAINT "whatsapp_media_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "whatsapp_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_media" ADD CONSTRAINT "whatsapp_media_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_media_trail" ADD CONSTRAINT "whatsapp_media_trail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_media_trail" ADD CONSTRAINT "whatsapp_media_trail_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "whatsapp_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_media_trail" ADD CONSTRAINT "whatsapp_media_trail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Written by hand (not generated) ─────────────────────────────────────────
-- Row level security, like the other 27 tables of public (catalog read on 2026-11-25): the public API roles have
-- SELECT on every table, and only this closes them. No policies and no FORCE, as the others: the app connects with
-- the owner role, which bypasses it. Check after applying: relrowsecurity = true on both tables.
ALTER TABLE "whatsapp_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_media_trail" ENABLE ROW LEVEL SECURITY;
