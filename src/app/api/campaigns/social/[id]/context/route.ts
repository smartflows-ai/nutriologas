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

  // Load tenant + SINGLE Facebook connected app (Instagram IG account ID lives in its metadata)
  const [tenant, fbApp] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, whatsappNumber: true, slug: true },
    }),
    prisma.connectedApp.findUnique({
      where: { tenantId_provider: { tenantId, provider: "FACEBOOK" } },
    }),
  ]);

  // Load selected products
  const products = campaign.productIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: campaign.productIds }, tenantId, deletedAt: null },
        select: { id: true, name: true, description: true, price: true, images: true, slug: true },
      })
    : [];

  // Both Facebook and Instagram credentials come from the same connected app row.
  // The Instagram Business Account ID is stored in metadata.igBusinessAccountId (fetched during OAuth).
  const fbMeta = fbApp?.metadata as {
    pageId?: string;
    pageName?: string;
    igBusinessAccountId?: string;
  } | null;

  // Build base URL for product links: use custom domain if set, otherwise subdomain
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      platforms: campaign.platforms,
      campaignGoal: campaign.campaignGoal,
      tone: campaign.tone,
      extraContext: campaign.extraContext,
    },
    products,
    tenant: {
      name: tenant?.name,
      slug: tenant?.slug,
      whatsappNumber: (tenant?.whatsappNumber ?? "").replace(/\D/g, ""),
      baseUrl: `https://${tenant?.slug}.${rootDomain}`,
    },
    // Single access token for both platforms (Meta Graph API).
    // Always return credentials if the FB app exists — an Instagram-only campaign still needs the token.
    facebook: fbApp ? {
      accessToken: fbApp.accessToken,
      pageId: fbMeta?.pageId,
      pageName: fbMeta?.pageName,
    } : null,
    instagram: fbApp && fbMeta?.igBusinessAccountId ? {
      igUserId: fbMeta.igBusinessAccountId,
    } : null,
  });
}
