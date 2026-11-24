"use server";
import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { AppProvider } from "@prisma/client";
import { checkWhatsAppDisconnect, startWhatsAppDisconnect } from "@/lib/whatsapp-disconnect-service";

export async function toggleAssistant(enabled: boolean) {
  const session = await getAppSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: { isAssistantEnabled: enabled }
  });

  revalidatePath("/admin/apps");
  revalidatePath("/admin/asistente");
  revalidatePath("/admin"); // Revalidate layout
}


export async function disconnectApp(provider: string) {
  const session = await getAppSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }

  const upper = provider.toUpperCase() as AppProvider;
  if (upper === "WHATSAPP") {
    // Step 1 only: sends the logout and returns. The screen then calls checkWhatsAppDisconnectAction until it is removed.
    const result = await startWhatsAppDisconnect(session.user.tenantId);
    if (!result.ok) throw new Error(result.error);
    revalidatePath("/admin/apps");
    revalidatePath("/admin");
    return { status: result.status };
  } else {
    await prisma.connectedApp.deleteMany({
      where: {
        tenantId: session.user.tenantId,
        provider: upper
      }
    });
  }

  revalidatePath("/admin/apps");
  revalidatePath("/admin"); // Revalidate layout to update sidebar
}

/** Step 2 of the WhatsApp disconnect: the screen calls it every few seconds until the line is removed. */
export async function checkWhatsAppDisconnectAction() {
  const session = await getAppSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
  const result = await checkWhatsAppDisconnect(session.user.tenantId);
  if (!result.ok) throw new Error(result.error);
  if (result.status === "removed") {
    revalidatePath("/admin/apps");
    revalidatePath("/admin");
  }
  return { status: result.status };
}

export async function refreshSidebar() {
  revalidatePath("/admin", "layout");
}
