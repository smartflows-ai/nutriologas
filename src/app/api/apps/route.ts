// src/app/api/apps/route.ts
// GET — list connected apps for the tenant (no tokens exposed)
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId as string;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { isAssistantEnabled: true }
  });

  const apps = await prisma.connectedApp.findMany({
    where: { tenantId },
    select: {
      provider: true,
      scopes: true,
      connectedAt: true,
      connectedByUserId: true,
    },
  });

  return NextResponse.json({ apps, isAssistantEnabled: tenant?.isAssistantEnabled ?? false });
}
