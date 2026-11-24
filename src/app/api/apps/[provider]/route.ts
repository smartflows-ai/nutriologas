// src/app/api/apps/[provider]/route.ts
// DELETE — disconnect an app for the tenant
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppProvider } from "@prisma/client";
import { disconnectWhatsAppLine } from "@/lib/whatsapp-disconnect-service";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId as string;
  const { provider: rawProvider } = await params;
  const provider = rawProvider.toUpperCase() as AppProvider;

  if (!Object.values(AppProvider).includes(provider)) {
    return NextResponse.json({ error: "Provider inválido" }, { status: 400 });
  }

  if (provider === "WHATSAPP") {
    const result = await disconnectWhatsAppLine(tenantId);
    if (!result.ok) {
      return NextResponse.json({ error: "No se pudo desconectar la línea de WhatsApp" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  await prisma.connectedApp.deleteMany({
    where: { tenantId, provider },
  });

  return NextResponse.json({ ok: true });
}
