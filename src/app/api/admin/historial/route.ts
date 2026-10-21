// src/app/api/admin/historial/route.ts
// GET: patients of the tenant with visit and note counts. Admin only.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError } from "@/lib/api-errors";
import { listPatients } from "@/lib/patients";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return apiError("unauthorized", 401);
    }

    const tenantId = (session.user as any).tenantId;
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").slice(0, 80);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);

    const { patients, total } = await listPatients(tenantId, q, page, PAGE_SIZE);
    return NextResponse.json({ patients, total, pageSize: PAGE_SIZE });
  } catch (error) {
    console.error("[GET /api/admin/historial] Error:", error);
    return apiError("internal_error", 500);
  }
}
