// src/app/ubicacion/route.ts
// <tenant>.newaigent.com/ubicacion: sends the customer straight to the business's directions in Google Maps.
// The destination is built from the address the business already has (no stored link to keep in sync).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { directionsUrl } from "@/lib/location";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { resolveTenantSlug } from "@/lib/tenant";
import { SHORT_LINK_HEADERS, shortLinkUnavailable } from "@/lib/short-link-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_PLACE = { titulo: "Ubicación no disponible", mensaje: "Este negocio no tiene una ubicación publicada." };

export async function GET(req: Request) {
  if (rateLimited(`short-ubicacion:${clientIp(req)}`, 60, 60_000)) {
    return new NextResponse("Demasiadas solicitudes. Intenta en un minuto.", { status: 429, headers: SHORT_LINK_HEADERS });
  }
  // The tenant comes from the host name only, never from the request body or query.
  const slug = resolveTenantSlug(req.headers.get("host") || "");
  if (!slug) return shortLinkUnavailable(NO_PLACE.titulo, NO_PLACE.mensaje);

  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ slug }, { customDomain: slug }] },
    select: { hasPhysicalLocation: true, address: true, placeId: true, latitude: true, longitude: true },
  });
  if (!tenant || !tenant.hasPhysicalLocation || !tenant.address?.trim()) {
    return shortLinkUnavailable(NO_PLACE.titulo, NO_PLACE.mensaje);
  }
  return NextResponse.redirect(directionsUrl({ address: tenant.address, placeId: tenant.placeId, latitude: tenant.latitude, longitude: tenant.longitude }), {
    status: 302,
    headers: SHORT_LINK_HEADERS,
  });
}
