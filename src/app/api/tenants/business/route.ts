// src/app/api/tenants/business/route.ts
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { apiError } from "@/lib/api-errors";
import { locationSchema } from "@/lib/location";
import {
  businessHoursSchema,
  isDefaultBusinessHours,
  parseBusinessHours,
} from "@/lib/business-hours";

const updateBusinessSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name cannot exceed 80 characters"),
  // Required: country code plus 8 to 15 digits (E.164), e.g. +528446683688
  whatsappNumber: z.string().trim().regex(/^\+\d{8,15}$/, "WhatsApp number must include the country code"),
  businessInfo: z.string().trim().max(3000, "Description cannot exceed 3000 characters").nullable().optional(),
  logoUrl: z.string().trim().nullable().optional(),
  businessHours: businessHoursSchema.optional(),
  ownerName: z.string().trim().max(80, "Owner name cannot exceed 80 characters").nullable().optional(),
  hasPhysicalLocation: z.boolean().optional(),
  address: z.string().nullable().optional(),
  placeId: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
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
        businessHours: true,
        ownerName: true,
        hasPhysicalLocation: true,
        address: true,
        placeId: true,
        latitude: true,
        longitude: true,
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
      businessHours: parseBusinessHours(tenant.businessHours),
      ownerName: tenant.ownerName,
      hasPhysicalLocation: tenant.hasPhysicalLocation,
      address: tenant.address,
      placeId: tenant.placeId,
      latitude: tenant.latitude,
      longitude: tenant.longitude,
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

    const { name, whatsappNumber, businessInfo, logoUrl, businessHours, ownerName } = parsed.data;

    // Address is required only when the business has a physical location; turning it off clears it.
    let locationData: {
      hasPhysicalLocation: boolean;
      address: string | null;
      placeId: string | null;
      latitude: number | null;
      longitude: number | null;
    } | null = null;
    if (parsed.data.hasPhysicalLocation !== undefined) {
      if (parsed.data.hasPhysicalLocation) {
        const place = locationSchema.safeParse(parsed.data);
        if (!place.success) return apiError("address_required", 400);
        locationData = {
          hasPhysicalLocation: true,
          address: place.data.address,
          placeId: place.data.placeId ?? null,
          latitude: place.data.latitude ?? null,
          longitude: place.data.longitude ?? null,
        };
      } else {
        locationData = { hasPhysicalLocation: false, address: null, placeId: null, latitude: null, longitude: null };
      }
    }

    // Stored as NULL when it equals the default schedule, so later default changes still apply.
    const hoursData =
      businessHours === undefined
        ? undefined
        : isDefaultBusinessHours(businessHours)
          ? Prisma.DbNull
          : businessHours;

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name,
        whatsappNumber,
        businessInfo: businessInfo ?? "",
        logoUrl: logoUrl || null,
        ...(ownerName !== undefined ? { ownerName: ownerName || null } : {}),
        ...(locationData ?? {}),
        ...(hoursData !== undefined ? { businessHours: hoursData } : {}),
      },
      select: {
        name: true,
        slug: true,
        customDomain: true,
        logoUrl: true,
        whatsappNumber: true,
        businessInfo: true,
        businessHours: true,
        ownerName: true,
        hasPhysicalLocation: true,
        address: true,
        placeId: true,
        latitude: true,
        longitude: true,
      },
    });

    return NextResponse.json({
      ...updated,
      businessHours: parseBusinessHours(updated.businessHours),
      tenant: updated,
      message: "Business information updated"
    });
  } catch (error) {
    console.error("[PATCH /api/tenants/business] Error:", error);
    return apiError("internal_error", 500);
  }
}
