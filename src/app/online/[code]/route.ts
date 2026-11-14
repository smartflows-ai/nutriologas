// src/app/online/[code]/route.ts
// <tenant>.newaigent.com/online/<code>: the video call of ONE appointment. It opens from the start of the visit until
// one hour after it ends; before or after, and for any unknown or malformed code, it answers the same closed page
// (no way to tell a code that exists from one that does not).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientIp, rateLimited } from "@/lib/rate-limit";
import { resolveTenantSlug } from "@/lib/tenant";
import { SHORT_CODE_RE, meetLinkState } from "@/lib/short-links";
import { SHORT_LINK_HEADERS, shortLinkUnavailable } from "@/lib/short-link-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLOSED = { titulo: "Este enlace ya no está disponible", mensaje: "Si necesitas entrar a tu cita, escríbenos por WhatsApp." };

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (rateLimited(`short-online:${clientIp(req)}`, 30, 60_000)) {
    return new NextResponse("Demasiadas solicitudes. Intenta en un minuto.", { status: 429, headers: SHORT_LINK_HEADERS });
  }
  const { code } = await params;
  // A malformed code never reaches the database.
  if (!SHORT_CODE_RE.test(code)) return shortLinkUnavailable(CLOSED.titulo, CLOSED.mensaje, 410);

  const slug = resolveTenantSlug(req.headers.get("host") || "");
  if (!slug) return shortLinkUnavailable(CLOSED.titulo, CLOSED.mensaje, 410);
  const tenant = await prisma.tenant.findFirst({ where: { OR: [{ slug }, { customDomain: slug }] }, select: { id: true } });
  if (!tenant) return shortLinkUnavailable(CLOSED.titulo, CLOSED.mensaje, 410);

  // Scoped by the tenant found from the host: a code of another business does not open here.
  const visit = await prisma.appointment.findFirst({
    where: { tenantId: tenant.id, meetShortCode: code },
    select: { status: true, modality: true, meetUrl: true, appointmentDate: true, durationMinutes: true },
  });
  if (!visit || !meetLinkState(visit, new Date()).open || !visit.meetUrl) {
    return shortLinkUnavailable(CLOSED.titulo, CLOSED.mensaje, 410);
  }
  return NextResponse.redirect(visit.meetUrl, { status: 302, headers: SHORT_LINK_HEADERS });
}
