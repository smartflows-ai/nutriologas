// src/app/api/campaigns/social/route.ts
// CRUD for SocialCampaign — list and create campaigns for the tenant
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CampaignFrequency, SocialPlatform } from "@prisma/client";

function computeNextPostAt(frequency: CampaignFrequency, from = new Date()): Date {
  const d = new Date(from);
  switch (frequency) {
    case "DAILY":       d.setDate(d.getDate() + 1); break;
    case "EVERY_3_DAYS": d.setDate(d.getDate() + 3); break;
    case "WEEKLY":      d.setDate(d.getDate() + 7); break;
    case "BIWEEKLY":    d.setDate(d.getDate() + 14); break;
    case "MONTHLY":     d.setMonth(d.getMonth() + 1); break;
  }
  return d;
}

// GET /api/campaigns/social — list campaigns
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId as string;

  const campaigns = await prisma.socialCampaign.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ campaigns });
}

// POST /api/campaigns/social — create campaign
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId as string;

  const body = await req.json();
  const {
    name,
    platforms,
    productIds,
    referenceImages,
    campaignGoal,
    tone,
    extraContext,
    frequency,
  } = body as {
    name?: string;
    platforms: SocialPlatform[];
    productIds: string[];
    referenceImages: string[];
    campaignGoal: string;
    tone: string;
    extraContext?: string;
    frequency: CampaignFrequency;
  };

  if (!platforms?.length || !campaignGoal || !tone || !frequency) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const nextPostAt = computeNextPostAt(frequency);

  const campaign = await prisma.socialCampaign.create({
    data: {
      tenantId,
      name: name ?? "Campaña",
      platforms,
      productIds: productIds ?? [],
      referenceImages: referenceImages ?? [],
      campaignGoal,
      tone,
      extraContext: extraContext ?? null,
      frequency,
      nextPostAt,
      isActive: true,
    },
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
