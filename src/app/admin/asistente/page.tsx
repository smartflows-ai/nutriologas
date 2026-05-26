// src/app/admin/asistente/page.tsx
import ChatAssistant from "@/components/chat/ChatAssistant";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Bot, Loader2, Zap } from "lucide-react";
import { getTranslationServer } from "@/i18n/server";

export default async function AsistentePage() {
  const t = getTranslationServer();
  const session = await getAppSession();
  const tenant = await prisma.tenant.findUnique({
    where: { id: session?.user.tenantId },
    select: { isAssistantEnabled: true }
  });

  if (!tenant?.isAssistantEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white dark:bg-gray-950 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm mt-4">
        <div className="bg-red-50 dark:bg-red-900/10 rounded-full p-3 w-16 h-16 flex items-center justify-center mx-auto mb-4 border-2 border-red-100 dark:border-red-900/30">
          <Bot size={32} className="text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t.crm.assistant.disabledTitle}</h2>
        <p className="text-gray-500 max-w-md mx-auto mb-8">
          {t.crm.assistant.disabledDesc}
        </p>
        <Link href="/admin/apps" className="btn-primary inline-flex items-center gap-2 px-8 py-3">
          <Zap size={20} />
          {t.crm.assistant.reactivateBtn}
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Bot className="text-primary" size={24} />
          {t.crm.assistant.title}
        </h1>
        <p className="text-gray-500 text-sm">{t.crm.assistant.subtitle}</p>
      </div>
      <ChatAssistant />
    </div>
  );
}
