// src/app/api/campaigns/social/due/route.ts
// GET — returns campaigns where nextPostAt <= now (for n8n scheduler)
// Secured with x-internal-secret header. NOT exposed to frontend.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();

  const campaigns = await prisma.socialCampaign.findMany({
    where: {
      isActive: true,
      nextPostAt: { lte: now },
      endDate: { gte: now },
    },
    select: {
      id: true,
      tenantId: true,
      name: true,
      platforms: true,
      productIds: true,
      campaignGoal: true,
      tone: true,
      extraContext: true,
      frequency: true,
      nextPostAt: true,
    },
  });

  return NextResponse.json({ campaigns, count: campaigns.length });
}
