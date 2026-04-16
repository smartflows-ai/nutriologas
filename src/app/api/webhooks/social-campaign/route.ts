import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    // 1. Verify internal secret
    const secret = req.headers.get("x-internal-secret");
    if (secret !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json().catch(() => null);
    if (!body || !body.campaignId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    console.log("[Social Webhook] Received payload:", body.type, "for campaign:", body.campaignId);

    // If it's an error notification, we may handle it specially
    if (body.type === "social_campaign_error") {
      console.warn(`[Social Webhook] Campaign ${body.campaignId} failed. Error:`, body.error);
      return NextResponse.json({ ok: false, error: "Logged error" });
    } else {
      console.log(`[Social Webhook] Campaign ${body.campaignId} successfully posted.`);

      let tenantId = body.tenantId;
      if (!tenantId) {
        const camp = await prisma.socialCampaign.findUnique({
          where: { id: body.campaignId },
          select: { tenantId: true }
        });
        if (!camp) return NextResponse.json({ error: "Campaign not found" }, { status: 400 });
        tenantId = camp.tenantId;
      }

      // Save it to the DB history table
      await prisma.socialPost.create({
        data: {
          tenantId: tenantId,
          campaignId: body.campaignId,
          content: body.content || "Contenido no reportado",
          platforms: body.platforms || [],
          frequency: body.frequency || "WEEKLY",
          postUrls: body.results || null,
          postedAt: body.postedAt ? new Date(body.postedAt) : new Date()
        }
      });
    }

    // Acknowledge receipt
    return NextResponse.json({ ok: true, received: true });

  } catch (error: any) {
    console.error("[Social Webhook API Error]:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
