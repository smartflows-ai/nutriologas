// src/lib/location.ts
// Business location (address picked with Google Maps) shared by sign-up, Negocio, the storefront and the bot.
import { z } from "zod";
import { locationShortUrl } from "@/lib/short-links";

export interface BusinessLocation {
  address: string;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export const locationSchema = z.object({
  address: z.string().trim().min(5).max(300),
  placeId: z.string().trim().max(300).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

// Google Maps directions link, built on read so it never goes stale.
export function directionsUrl(location: BusinessLocation): string {
  const hasCoords = typeof location.latitude === "number" && typeof location.longitude === "number";
  const destination = hasCoords ? `${location.latitude},${location.longitude}` : location.address;
  const params = new URLSearchParams({ api: "1", destination });
  if (location.placeId) params.set("destination_place_id", location.placeId);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

interface TenantLocationFields {
  /** Used to build the short address (<tenant>.newaigent.com/ubicacion) that customers receive. */
  slug: string;
  customDomain?: string | null;
  hasPhysicalLocation: boolean;
  address: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
}

// Address plus the short link to the directions (the business's own subdomain, /ubicacion), for the WhatsApp bot and
// the reminders. The long Google Maps address stays behind the short link. Empty when there is no physical place.
export function locationTextForBot(tenant: TenantLocationFields): string {
  if (!tenant.hasPhysicalLocation || !tenant.address) return "";
  return `${tenant.address} (${locationShortUrl({ slug: tenant.slug, customDomain: tenant.customDomain })})`;
}
