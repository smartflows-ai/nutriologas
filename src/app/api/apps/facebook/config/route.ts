// src/app/api/apps/facebook/config/route.ts
// GET — return Facebook page metadata for the tenant (no token exposed)
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

  const fbApp = await prisma.connectedApp.findUnique({
    where: { tenantId_provider: { tenantId, provider: "FACEBOOK" } },
    select: { metadata: true, connectedAt: true },
  });

  if (!fbApp) {
    return NextResponse.json(null);
  }

  const meta = fbApp.metadata as {
    pageId: string;
    pageName: string;
    allPages?: { id: string; name: string }[];
  } | null;

  return NextResponse.json({
    pageId: meta?.pageId ?? null,
    pageName: meta?.pageName ?? "Mi Página",
    allPages: meta?.allPages ?? [],
    connectedAt: fbApp.connectedAt,
  });
}
