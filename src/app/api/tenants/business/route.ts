// src/app/api/tenants/business/route.ts
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { apiError } from "@/lib/api-errors";

const updateBusinessSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name cannot exceed 80 characters"),
  // Required: country code plus 8 to 15 digits (E.164), e.g. +528446683688
  whatsappNumber: z.string().trim().regex(/^\+\d{8,15}$/, "WhatsApp number must include the country code"),
  businessInfo: z.string().trim().max(3000, "Description cannot exceed 3000 characters").nullable().optional(),
  logoUrl: z.string().trim().nullable().optional(),
});

export async function GET() {
  try {
    const session = await getAppSession();
    if (!session?.user || session.user.role !== "ADMIN") {
      return apiError("unauthorized", 401);
    }

    const tenantId = session.user.tenantId;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        slug: true,
        customDomain: true,
        logoUrl: true,
        whatsappNumber: true,
        businessInfo: true,
      },
    });

    if (!tenant) {
      return apiError("tenant_not_found", 404);
    }

    return NextResponse.json({
      name: tenant.name,
      slug: tenant.slug,
      customDomain: tenant.customDomain,
      logoUrl: tenant.logoUrl,
      whatsappNumber: tenant.whatsappNumber,
      businessInfo: tenant.businessInfo,
      tenant,
    });
  } catch (error) {
    console.error("[GET /api/tenants/business] Error:", error);
    return apiError("internal_error", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getAppSession();
    if (!session?.user || session.user.role !== "ADMIN") {
      return apiError("unauthorized", 401);
    }

    const tenantId = session.user.tenantId;
    const json = await req.json();
    const parsed = updateBusinessSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, whatsappNumber, businessInfo, logoUrl } = parsed.data;

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name,
        whatsappNumber,
        businessInfo: businessInfo ?? "",
        logoUrl: logoUrl || null,
      },
      select: {
        name: true,
        slug: true,
        customDomain: true,
        logoUrl: true,
        whatsappNumber: true,
        businessInfo: true,
      },
    });

    return NextResponse.json({
      ...updated,
      tenant: updated,
      message: "Business information updated"
    });
  } catch (error) {
    console.error("[PATCH /api/tenants/business] Error:", error);
    return apiError("internal_error", 500);
  }
}
