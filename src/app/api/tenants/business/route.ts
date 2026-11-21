// src/app/api/tenants/business/route.ts
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { apiError, apiErrorWith } from "@/lib/api-errors";
import { loadZoneShift } from "@/lib/time-zone-change-data";
import { locationSchema } from "@/lib/location";
import { ownerNameIsFilled } from "@/lib/owner-name";
import { isSameWhatsAppNumber } from "@/lib/whatsapp-number";
import { isValidTimeZone } from "@/lib/clinic-time";
import { usableTimeZone } from "@/lib/tenant-time-zone";
import { chooseTimeZone, shouldDetectTimeZone, timeZoneSourceOf } from "@/lib/time-zone-choice";
import { lookupTimeZone, realTimeZoneLookupDeps } from "@/lib/time-zone-lookup";
import {
  businessHoursSchema,
  isDefaultBusinessHours,
  parseBusinessHours,
} from "@/lib/business-hours";

const updateBusinessSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name cannot exceed 80 characters"),
  // Required: country code plus 8 to 15 digits (E.164), e.g. +525512345678
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
  // How the business sees patients; with BOTH the bot and the web ask each visit (see patient-intake.ts).
  serviceModes: z.enum(["IN_PERSON", "ONLINE", "BOTH"]).optional(),
  // The business time zone (IANA). Checked below with isValidTimeZone: answers time_zone_invalid.
  timeZone: z.string().trim().max(64).optional(),
  // Ticket #127: the owner saw the visits that will show another hour on the new zone and accepts it.
  confirmZoneShift: z.boolean().optional(),
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
        serviceModes: true,
        timeZone: true,
        timeZoneSource: true,
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
      serviceModes: tenant.serviceModes,
      timeZone: usableTimeZone(tenant.timeZone),
      timeZoneSource: timeZoneSourceOf(tenant.timeZoneSource),
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
    // The owner or person in charge is required whenever the business is saved with one: it is the name the texts use.
    if (ownerName !== undefined && !ownerNameIsFilled(ownerName)) {
      return apiError("owner_name_required", 400);
    }

    // The owner's number must not be the line the WhatsApp bot sends from (a message would go to itself).
    const botLine = await prisma.connectedApp.findUnique({
      where: { tenantId_provider: { tenantId, provider: "WHATSAPP" } },
      select: { waPhoneNumber: true },
    });
    if (isSameWhatsAppNumber(whatsappNumber, botLine?.waPhoneNumber)) {
      return apiError("owner_number_is_bot_line", 400);
    }

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

    // Time zone (ticket #111): the owner's choice wins; otherwise new address coordinates are asked to Google.
    // A failed lookup keeps the zone and never blocks saving the address.
    const requestedZone = parsed.data.timeZone;
    if (requestedZone !== undefined && !isValidTimeZone(requestedZone)) return apiError("time_zone_invalid", 400);
    const stored = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timeZone: true, timeZoneSource: true, latitude: true, longitude: true },
    });
    const zoneInput = {
      current: { timeZone: usableTimeZone(stored?.timeZone), source: timeZoneSourceOf(stored?.timeZoneSource) },
      requested: requestedZone,
      addressChanged:
        locationData?.latitude != null &&
        locationData.longitude != null &&
        (locationData.latitude !== stored?.latitude || locationData.longitude !== stored?.longitude),
    };
    const detected =
      shouldDetectTimeZone(zoneInput) && locationData?.latitude != null && locationData.longitude != null
        ? await lookupTimeZone(locationData.latitude, locationData.longitude, realTimeZoneLookupDeps)
        : null;
    const zone = chooseTimeZone({ ...zoneInput, detected });

    // Ticket #127: a new zone that makes booked visits read another hour is saved only after the owner saw them.
    if (zone.timeZone !== zoneInput.current.timeZone && parsed.data.confirmZoneShift !== true) {
      const shift = await loadZoneShift(tenantId, zone.timeZone);
      if (shift.visits.length > 0) {
        return apiErrorWith("time_zone_shift_unconfirmed", 409, { count: shift.visits.length, toZone: zone.timeZone });
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
        ...(parsed.data.serviceModes ? { serviceModes: parsed.data.serviceModes } : {}),
        ...(locationData ?? {}),
        ...(hoursData !== undefined ? { businessHours: hoursData } : {}),
        timeZone: zone.timeZone,
        timeZoneSource: zone.source,
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
        serviceModes: true,
        timeZone: true,
        timeZoneSource: true,
      },
    });

    return NextResponse.json({
      ...updated,
      // detected | failed | skipped: the screen tells the owner what happened with the zone.
      timeZoneDetection: zone.detection,
      businessHours: parseBusinessHours(updated.businessHours),
      tenant: updated,
      message: "Business information updated"
    });
  } catch (error) {
    console.error("[PATCH /api/tenants/business] Error:", error);
    return apiError("internal_error", 500);
  }
}
