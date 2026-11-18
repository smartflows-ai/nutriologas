// src/app/api/internal/bot/alert-failure/route.ts
// Internal endpoint for n8n: alerts the tenant owner when the WhatsApp bot's
// entire model cascade failed to answer a customer. Throttled server-side so a
// burst of failures during an outage only pages the owner once per cooldown.
// Auth: x-internal-key header (same as other internal routes).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyTenantOwner } from "@/lib/whatsapp";
import { shouldAlertOwner } from "@/lib/owner-alert";

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get("x-internal-key") === process.env.INTERNAL_API_KEY;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { tenantId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId } = body;
  if (!tenantId) {
    return NextResponse.json({ error: "Required: tenantId (string)" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { botFailureAlertedAt: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (!shouldAlertOwner(new Date(), tenant.botFailureAlertedAt)) {
    return NextResponse.json({ alerted: false });
  }

  // The cooldown is written only after the owner was told. A failed send leaves it unset, so the next failure retries.
  const sent = await notifyTenantOwner(
    tenantId,
    "El asistente de WhatsApp no pudo responder a un cliente por una falla temporal. Revisa el panel o contacta al cliente manualmente.",
  );
  if (!sent) {
    return NextResponse.json({ alerted: false, error: "owner_alert_failed" }, { status: 502 });
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { botFailureAlertedAt: new Date() },
  });

  return NextResponse.json({ alerted: true });
}
