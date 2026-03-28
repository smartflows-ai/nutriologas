// src/app/api/apps/facebook/setup/route.ts
// DEV-ONLY: Manually set a Facebook Page Access Token (bypasses OAuth).
// Use this while Meta App is being configured/reviewed.
// Remove or protect this route before going to production.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId as string;
  const userId = (session.user as any).id as string;

  const { pageAccessToken, pageId, pageName } = await req.json();

  if (!pageAccessToken || !pageId) {
    return NextResponse.json({ error: "pageAccessToken y pageId son requeridos" }, { status: 400 });
  }

  await prisma.connectedApp.upsert({
    where: { tenantId_provider: { tenantId, provider: "FACEBOOK" } },
    update: {
      accessToken: pageAccessToken,
      connectedByUserId: userId,
      metadata: { pageId, pageName: pageName ?? "Mi Página", allPages: [] },
    },
    create: {
      tenantId,
      provider: "FACEBOOK",
      accessToken: pageAccessToken,
      connectedByUserId: userId,
      metadata: { pageId, pageName: pageName ?? "Mi Página", allPages: [] },
    },
  });

  return NextResponse.json({ ok: true, pageId, pageName });
}
