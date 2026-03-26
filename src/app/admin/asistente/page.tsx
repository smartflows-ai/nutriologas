// src/app/admin/asistente/page.tsx
import ChatAssistant from "@/components/chat/ChatAssistant";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Bot } from "lucide-react";

export default async function AsistentePage() {
  const session = await getServerSession(authOptions);
  const tenant = await prisma.tenant.findUnique({
    where: { id: (session?.user as any)?.tenantId },
    select: { isAssistantEnabled: true }
  });

  if (!tenant?.isAssistantEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white dark:bg-gray-950 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm mt-4">
        <Bot size={64} className="text-gray-300 dark:text-gray-700 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Asistente IA Desactivado</h2>
        <p className="text-gray-500 mb-6 max-w-sm">
          Has apagado el asistente inteligente para tu clínica. Sus respuestas automáticas están pausadas.
        </p>
        <Link href="/admin/apps" className="btn-primary px-6 py-2.5 rounded-xl font-medium inline-flex items-center gap-2">
          <Bot size={18} /> Re-activar Asistente
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Asistente IA</h1>
        <p className="text-gray-500 text-sm">Pregúntame sobre tus ventas, clientes, reviews o citas</p>
      </div>
      <ChatAssistant />
    </div>
  );
}
