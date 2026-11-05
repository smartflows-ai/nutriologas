// src/app/api/apps/route.ts
// GET — list connected apps for the tenant (no tokens exposed)
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CAPABILITIES, isPlanLockedInCatalog, toolStatus } from "@/lib/capabilities";
import { capabilityContextForTenant } from "@/lib/capability-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId as string;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { isAssistantEnabled: true, isTriageEnabled: true }
  });

  const apps = await prisma.connectedApp.findMany({
    where: { tenantId },
    select: {
      provider: true,
      scopes: true,
      connectedAt: true,
      connectedByUserId: true,
      metadata: true, // needed to surface igBusinessAccountId for the Meta card
    },
  });

  // Safe-expose only non-sensitive metadata fields to the client
  const safeApps = apps.map(app => {
    const meta = app.metadata as Record<string, unknown> | null;
    return {
      provider: app.provider,
      scopes: app.scopes,
      connectedAt: app.connectedAt,
      connectedByUserId: app.connectedByUserId,
      // Expose Facebook page name and Instagram linked flag only (never tokens)
      ...(app.provider === "FACEBOOK" && meta ? {
        pageName: meta.pageName as string | undefined,
        igLinked: !!meta.igBusinessAccountId,
      } : {}),
    };
  });

  // Tools above the tenant's plan: the App Store shows them with a legend and a link to billing.
  const ctx = await capabilityContextForTenant(tenantId);
  const planLocked = ctx ? CAPABILITIES.filter((c) => isPlanLockedInCatalog(c, ctx)).map((c) => c.id) : [];
  // Owner-activated tools: locked / available / active / hidden, shown on their App Store cards.
  const toolStatuses = ctx
    ? Object.fromEntries(CAPABILITIES.filter((c) => c.activatable).map((c) => [c.id, toolStatus(c, ctx)]))
    : {};

  return NextResponse.json({ apps: safeApps, isAssistantEnabled: tenant?.isAssistantEnabled ?? false, isTriageEnabled: tenant?.isTriageEnabled ?? false, planLocked, toolStatuses });
}
