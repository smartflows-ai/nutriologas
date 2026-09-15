// src/app/api/campaigns/social/due/route.ts
// GET — returns campaigns where nextPostAt <= now (for n8n scheduler)
// Secured with x-internal-secret header. NOT exposed to frontend.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCreditStatus, pauseCampaignsForTenant } from "@/lib/credits";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();

  const rawCampaigns = await prisma.socialCampaign.findMany({
    where: {
      isActive: true,
      pausedByCredits: false,
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

  // Verify credit status per tenant before handing over to n8n
  const campaigns = [];
  const tenantCreditsChecked = new Map<string, boolean>();

  for (const c of rawCampaigns) {
    let hasCredits = tenantCreditsChecked.get(c.tenantId);
    if (hasCredits === undefined) {
      try {
        const status = await getCreditStatus(c.tenantId);
        hasCredits = !status.isExhausted;
        if (!hasCredits) {
          await pauseCampaignsForTenant(c.tenantId);
        }
      } catch {
        hasCredits = true;
      }
      tenantCreditsChecked.set(c.tenantId, hasCredits);
    }

    if (hasCredits) {
      campaigns.push(c);
    }
  }

  return NextResponse.json({ campaigns, count: campaigns.length });
}
