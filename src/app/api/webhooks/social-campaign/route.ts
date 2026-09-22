import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordTokenUsage } from "@/lib/credits";

export async function POST(req: Request) {
  try {
    // 1. Verify internal secret
    const secret = req.headers.get("x-internal-secret");
    if (!process.env.INTERNAL_API_KEY || secret !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json().catch(() => null);
    if (!body || !body.campaignId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // If it's an error notification, we may handle it specially
    if (body.type === "social_campaign_error") {
      return NextResponse.json({ ok: false, error: "Logged error" });
    } else {

      let tenantId = body.tenantId;
      if (!tenantId) {
        const camp = await prisma.socialCampaign.findUnique({
          where: { id: body.campaignId },
          select: { tenantId: true }
        });
        if (!camp) return NextResponse.json({ error: "Campaign not found" }, { status: 400 });
        tenantId = camp.tenantId;
      }

      // Record token usage if provided by n8n workflow
      let creditStatus = null;
      const usage = body.tokenUsage || body.usage;
      if (usage) {
        try {
          const promptTokens = Number(usage.promptTokens ?? usage.prompt_tokens) || 0;
          const completionTokens = Number(usage.completionTokens ?? usage.completion_tokens) || 0;
          const modelId = usage.model || usage.modelId || "anthropic/claude-sonnet-4.5";

          if (promptTokens > 0 || completionTokens > 0) {
            creditStatus = await recordTokenUsage(
              tenantId,
              promptTokens,
              completionTokens,
              undefined,
              modelId
            );
          }
        } catch (creditErr) {
          console.error("[Social Webhook] Failed to record token usage:", creditErr);
        }
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

      // Acknowledge receipt
      return NextResponse.json({ ok: true, received: true, creditStatus });
    }

  } catch (error: any) {
    console.error("[Social Webhook API Error]:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
