"use server";
import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { AppProvider } from "@prisma/client";

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

  await prisma.connectedApp.deleteMany({
    where: {
      tenantId: session.user.tenantId,
      provider: provider.toUpperCase() as AppProvider
    }
  });

  revalidatePath("/admin/apps");
  revalidatePath("/admin"); // Revalidate layout to update sidebar
}

export async function refreshSidebar() {
  revalidatePath("/admin", "layout");
}
