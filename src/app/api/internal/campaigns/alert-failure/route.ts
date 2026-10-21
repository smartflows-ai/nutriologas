// src/app/api/internal/campaigns/alert-failure/route.ts
// Internal endpoint for n8n: alerts the tenant owner when an automated social
// campaign post failed. Throttled using the campaign's own lastErrorAt (read
// before "Mark Campaign Error in CRM" overwrites it in the parallel branch),
// so a campaign that keeps failing on the same schedule doesn't page the
// owner more than once per cooldown.
// Auth: x-internal-key header (same as other internal routes).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyTenantOwner } from "@/lib/whatsapp";

const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get("x-internal-key") === process.env.INTERNAL_API_KEY;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { tenantId?: string; campaignId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId, campaignId } = body;
  if (!tenantId || !campaignId) {
    return NextResponse.json({ error: "Required: tenantId (string), campaignId (string)" }, { status: 400 });
  }

  const campaign = await prisma.socialCampaign.findFirst({
    where: { id: campaignId, tenantId },
    select: { lastErrorAt: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const withinCooldown = campaign.lastErrorAt && Date.now() - campaign.lastErrorAt.getTime() < COOLDOWN_MS;
  if (withinCooldown) {
    return NextResponse.json({ alerted: false });
  }

  await notifyTenantOwner(
    tenantId,
    "No pudimos publicar automáticamente una de tus campañas de redes sociales. Revisa el panel de Campañas para más detalles.",
  );

  return NextResponse.json({ alerted: true });
}
