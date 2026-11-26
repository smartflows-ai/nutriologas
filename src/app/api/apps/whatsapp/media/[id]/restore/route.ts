// src/app/api/apps/whatsapp/media/[id]/restore/route.ts
// POST: restore a hidden WhatsApp file of the session's business (ticket #182, plan R6). The owner and staff with
// access to chats can do it; the trail keeps who, with which role and when. The destruction date never moves.
import type { UserRole } from "@prisma/client";
import { requirePermission } from "@/lib/permission-guard";
import { apiError } from "@/lib/api-errors";
import { mediaEnabledFor, setMediaHidden } from "@/lib/wa-media-data";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const access = await requirePermission("whatsapp.chats");
  if (!access.ok) return access.response;
  // The role comes from the session that passed requirePermission (owner or staff), never from the request.
  const { tenantId, session, role } = access;
  if (!mediaEnabledFor(tenantId)) return apiError("whatsapp_media_not_found", 404);

  const result = await setMediaHidden(tenantId, params.id, { userId: session.user.id, role: role as UserRole }, false);
  if (result === "not_found") return apiError("whatsapp_media_not_found", 404);
  if (result === "not_available") return apiError("whatsapp_media_not_available", 409);
  return Response.json({ ok: true });
}
