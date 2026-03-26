// src/app/admin/asistente/page.tsx
import ChatAssistant from "@/components/chat/ChatAssistant";

export default function AsistentePage() {
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
