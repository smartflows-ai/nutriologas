// src/app/api/internal/tokens/report/route.ts
// Internal endpoint for n8n to report token usage from WhatsApp AI responses.
// Auth: x-internal-key header (same as other internal routes).

import { NextRequest, NextResponse } from "next/server";
import { recordTokenUsage } from "@/lib/credits";
import { prisma } from "@/lib/db";

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get("x-internal-key") === process.env.INTERNAL_API_KEY;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { tenantId?: string; promptTokens?: number; completionTokens?: number; modelId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId, promptTokens, completionTokens, modelId } = body;
  if (!tenantId || typeof promptTokens !== "number" || typeof completionTokens !== "number") {
    return NextResponse.json(
      { error: "Required: tenantId (string), promptTokens (number), completionTokens (number)" },
      { status: 400 },
    );
  }

  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { plan: true },
  });
  const planId = (sub?.plan as string) ?? "STARTER";

  const status = await recordTokenUsage(tenantId, promptTokens, completionTokens, planId, modelId);


  return NextResponse.json({
    success: true,
    creditStatus: {
      usedUsd:     status.usedUsd,
      limitUsd:    status.limitUsd,
      isExhausted: status.isExhausted,
    },
  });
}
