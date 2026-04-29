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
  if (body.campaignGoal !== undefined) updateData.campaignGoal = body.campaignGoal;
  if (body.tone !== undefined) updateData.tone = body.tone;
  if (body.extraContext !== undefined) updateData.extraContext = body.extraContext;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;
  if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate);
  if (body.endDate !== undefined && body.endDate !== null) updateData.endDate = new Date(body.endDate);

  // After posting: update lastPostedAt and compute nextPostAt
  if (body.markPosted) {
    const now = new Date();
    updateData.lastPostedAt = now;
    if (body.postResults) updateData.lastResults = body.postResults;

    // Fetch campaign to check bounds
    const campaign = await prisma.socialCampaign.findUnique({ where: { id: params.id } });
    if (campaign) {
      const nextTime = computeNextPostAt(campaign.frequency, now);
      updateData.nextPostAt = nextTime;
      // If we've passed the endDate, deactivate the campaign
      if (campaign.endDate && nextTime > campaign.endDate) {
        updateData.isActive = false;
      }
    }
  }

  // Error handling from n8n
  if (body.markError) {
    updateData.lastError = body.errorMessage || "Unknown error";
    updateData.errorNode = body.errorNode || "unknown node";
    updateData.lastErrorAt = body.errorAt ? new Date(body.errorAt) : new Date();
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
