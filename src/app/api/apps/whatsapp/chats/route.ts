// src/app/api/apps/whatsapp/chats/route.ts
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { NextRequest } from "next/server";
import { canAssignHelp } from "@/lib/help-actions";
import { compareChatsForViewer } from "@/lib/chat-order";

export async function GET(req: NextRequest) {
  const access = await requirePermission("whatsapp.chats");
  if (!access.ok) return access.response;
  const { tenantId } = access;
  const viewerId = access.session.user.id ?? "";

  try {
    // Consultar chats guardados localmente. Every chat is listed; the order puts help priority first, then the chats
    // the viewer is in charge of, then other assistants' chats (see chat-order.ts).
    const found = await prisma.whatsAppChat.findMany({
      where: { tenantId },
      orderBy: [{ helpPriority: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        remoteJid: true,
        pushName: true,
        lastMessage: true,
        updatedAt: true,
        botEnabled: true,
        botPausedReason: true,
        helpReason: true,
        helpPriority: true,
        helpRequestedAt: true,
        helpTakenAt: true,
        helpCustomerWroteAt: true,
        optedOutAt: true,
        assignedToId: true,
        assignedTo: { select: { name: true, email: true } },
      }
    });
    const chats = [...found].sort((a, b) => compareChatsForViewer(a, b, viewerId));

    // Only the owner assigns chats, so only the owner receives the list of assistants to choose from.
    const assistants = canAssignHelp(access.role)
      ? await prisma.user.findMany({
          where: { tenantId, role: "STAFF", isActive: true },
          select: { id: true, name: true, email: true, whatsappNumber: true },
          orderBy: { createdAt: "asc" },
        })
      : [];

    return Response.json({ chats, assistants, viewerId });
  } catch (error: any) {
    console.error("Error loading local WhatsApp chats:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
