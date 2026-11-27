// src/app/api/apps/whatsapp/media/[id]/route.ts
// GET: a 5-minute signed link to one WhatsApp file of the session's business (ticket #182, plan R8 and R9). The
// file is loaded with the session's business, so another business's id and an invented one both answer "not found".
// The download name and the type are set here, on the server; the browser only sends the id. Never cached.
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { apiError } from "@/lib/api-errors";
import { decideMediaLink, fallbackDownloadName } from "@/lib/wa-media-access";
import { findMediaForTenant, mediaEnabledFor } from "@/lib/wa-media-data";
import { SIGNED_URL_SECONDS, serverMediaStore } from "@/lib/wa-media-storage";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const access = await requirePermission("whatsapp.chats");
  if (!access.ok) return access.response;
  const { tenantId } = access;
  // A business that is off answers like an unknown id and never reads the file tables.
  if (!mediaEnabledFor(tenantId)) return apiError("whatsapp_media_not_found", 404);

  const [row, tenant] = await Promise.all([
    findMediaForTenant(tenantId, params.id),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { messageLanguage: true } }),
  ]);
  const decision = decideMediaLink(row, tenantId, new Date(), fallbackDownloadName(tenant?.messageLanguage));
  if (!decision.ok) {
    return decision.error === "not_found" ? apiError("whatsapp_media_not_found", 404) : apiError("whatsapp_media_not_available", 410);
  }
  const signed = await serverMediaStore().signedUrl(decision.path, decision.options);
  if (!signed.ok) return apiError("whatsapp_media_link_failed", 503);
  return Response.json({ url: signed.value, mode: decision.mode, expiresIn: SIGNED_URL_SECONDS }, { headers: NO_STORE });
}
