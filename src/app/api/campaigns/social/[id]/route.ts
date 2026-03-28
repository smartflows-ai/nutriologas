// src/app/api/campaigns/social/[id]/route.ts
// PATCH and DELETE for a specific SocialCampaign
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CampaignFrequency, SocialPlatform } from "@prisma/client";

function computeNextPostAt(frequency: CampaignFrequency, from = new Date()): Date {
  const d = new Date(from);
  switch (frequency) {
    case "DAILY":        d.setDate(d.getDate() + 1); break;
    case "EVERY_3_DAYS": d.setDate(d.getDate() + 3); break;
    case "WEEKLY":       d.setDate(d.getDate() + 7); break;
    case "BIWEEKLY":     d.setDate(d.getDate() + 14); break;
    case "MONTHLY":      d.setMonth(d.getMonth() + 1); break;
  }
  return d;
}

// PATCH — update campaign (edit, pause/resume, update after post)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    // Also allow internal calls with secret header
    const internalSecret = req.headers.get("x-internal-secret");
    if (internalSecret !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const tenantId = session ? (session.user as any).tenantId as string : undefined;
  const body = await req.json();

  // Build update data
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.platforms !== undefined) updateData.platforms = body.platforms;
  if (body.productIds !== undefined) updateData.productIds = body.productIds;
  if (body.referenceImages !== undefined) updateData.referenceImages = body.referenceImages;
  if (body.campaignGoal !== undefined) updateData.campaignGoal = body.campaignGoal;
  if (body.tone !== undefined) updateData.tone = body.tone;
  if (body.extraContext !== undefined) updateData.extraContext = body.extraContext;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  // After posting: update lastPostedAt and compute nextPostAt
  if (body.markPosted) {
    const now = new Date();
    updateData.lastPostedAt = now;
    // Fetch frequency to compute next
    const campaign = await prisma.socialCampaign.findUnique({ where: { id: params.id } });
    if (campaign) {
      updateData.nextPostAt = computeNextPostAt(campaign.frequency, now);
    }
  }

  if (body.frequency !== undefined) {
    updateData.frequency = body.frequency;
    updateData.nextPostAt = computeNextPostAt(body.frequency as CampaignFrequency);
  }

  const campaign = await prisma.socialCampaign.update({
    where: { id: params.id },
    data: updateData,
  });

  return NextResponse.json({ campaign });
}

// DELETE — remove campaign
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId as string;

  await prisma.socialCampaign.deleteMany({
    where: { id: params.id, tenantId },
  });

  return NextResponse.json({ ok: true });
}
