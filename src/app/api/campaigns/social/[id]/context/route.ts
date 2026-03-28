// src/app/api/campaigns/social/[id]/context/route.ts
// GET — returns full campaign context for n8n agent to use when generating the post
// Includes: campaign config, product details, tenant WhatsApp, FB/IG credentials
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campaign = await prisma.socialCampaign.findUnique({
    where: { id: params.id },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const { tenantId } = campaign;

  // Load tenant + connected apps in parallel
  const [tenant, fbApp, igApp] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, whatsappNumber: true, slug: true },
    }),
    prisma.connectedApp.findUnique({
      where: { tenantId_provider: { tenantId, provider: "FACEBOOK" } },
    }),
    prisma.connectedApp.findUnique({
      where: { tenantId_provider: { tenantId, provider: "INSTAGRAM" } },
    }),
  ]);

  // Load selected products
  const products = campaign.productIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: campaign.productIds }, tenantId, deletedAt: null },
        select: { id: true, name: true, description: true, price: true, images: true },
      })
    : [];

  const fbMeta = fbApp?.metadata as { pageId?: string; pageName?: string } | null;
  const igMeta = igApp?.metadata as { pageId?: string; pageName?: string } | null;

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      platforms: campaign.platforms,
      campaignGoal: campaign.campaignGoal,
      tone: campaign.tone,
      extraContext: campaign.extraContext,
      referenceImages: campaign.referenceImages,
    },
    products,
    tenant: {
      name: tenant?.name,
      slug: tenant?.slug,
      whatsappNumber: (tenant?.whatsappNumber ?? "").replace(/\D/g, ""),
    },
    facebook: campaign.platforms.includes("FACEBOOK") && fbApp ? {
      accessToken: fbApp.accessToken,
      pageId: fbMeta?.pageId,
      pageName: fbMeta?.pageName,
    } : null,
    instagram: campaign.platforms.includes("INSTAGRAM") && igApp ? {
      accessToken: igApp.accessToken,
      pageId: igMeta?.pageId,
    } : null,
  });
}
