import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    // Filters
    const platform = searchParams.get("platform");
    const frequency = searchParams.get("frequency");
    const search = searchParams.get("search") || "";

    const where: any = { tenantId };
    
    if (platform) {
      where.platforms = { has: platform };
    }
    
    if (frequency) {
      where.frequency = frequency;
    }
    
    if (search) {
      where.OR = [
        { content: { contains: search, mode: "insensitive" } },
        { campaign: { name: { contains: search, mode: "insensitive" } } }
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.socialPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { postedAt: "desc" },
        include: {
          campaign: {
            select: { name: true }
          }
        }
      }),
      prisma.socialPost.count({ where })
    ]);

    return NextResponse.json({
      posts,
      totalCount: total,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error("[Social History API Error]:", error);
    return NextResponse.json({ error: "No se pudo cargar el historial" }, { status: 500 });
  }
}
