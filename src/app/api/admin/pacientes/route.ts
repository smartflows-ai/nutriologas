import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;

    const patients = await prisma.patientProfile.findMany({
      where: { tenantId },
      include: {
        user: {
          select: { name: true, email: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json({ patients });
  } catch (error: any) {
    console.error("[Pacientes Admin API Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
