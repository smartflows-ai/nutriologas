"use server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { AppProvider } from "@prisma/client";

export async function toggleAssistant(enabled: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    throw new Error("No autorizado");
  }
  
  await prisma.tenant.update({
    where: { id: (session.user as any).tenantId },
    data: { isAssistantEnabled: enabled }
  });

  revalidatePath("/admin/apps");
  revalidatePath("/admin/asistente");
  revalidatePath("/admin"); // Revalidate layout
}

export async function disconnectApp(provider: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    throw new Error("No autorizado");
  }

  await prisma.connectedApp.deleteMany({
    where: {
      tenantId: (session.user as any).tenantId,
      provider: provider.toUpperCase() as AppProvider
    }
  });

  revalidatePath("/admin/apps");
  revalidatePath("/admin"); // Revalidate layout to update sidebar
}

export async function refreshSidebar() {
  revalidatePath("/admin", "layout");
}
