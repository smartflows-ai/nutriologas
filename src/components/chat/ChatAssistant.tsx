"use client";
// src/components/chat/ChatAssistant.tsx
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Sparkles } from "lucide-react";

interface Message { role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "¿Cómo van mis ventas este mes?",
  "¿Cuáles son mis productos más vendidos?",
  "¿Tengo reviews negativos recientes?",
  "¿Cuántos clientes nuevos tuve este mes?",
  "¿Qué producto me recomiendas promocionar más?",
  "¿Cuántas citas tuve esta semana?",
];

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? "bg-primary text-white" : "bg-gray-100 text-gray-600"}`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? "bg-primary text-white rounded-tr-sm" : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"}`}>
        {/* Render markdown-like formatting */}
        {message.content.split("\n").map((line, i) => {
          if (line.startsWith("# ")) return <p key={i} className="font-bold text-base mb-1">{line.slice(2)}</p>;
          if (line.startsWith("## ")) return <p key={i} className="font-semibold mb-1">{line.slice(3)}</p>;
          if (line.startsWith("- ") || line.startsWith("• ")) return <p key={i} className="ml-2">• {line.slice(2)}</p>;
          if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;
          if (line === "") return <div key={i} className="h-2" />;
          return <p key={i}>{line}</p>;
        })}
      </div>
    </div>
  );
}

export default function ChatAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) throw new Error("Error del servidor");
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Ocurrió un error. Por favor intenta de nuevo." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden min-h-0">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
        {/* Welcome state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles size={32} className="text-primary" />
            </div>
            <h2 className="font-bold text-gray-900 text-lg mb-2">Asistente de negocios</h2>
            <p className="text-gray-500 text-sm mb-8 max-w-sm">
              Pregúntame sobre tus ventas, clientes, productos o citas. Analizo tus datos en tiempo real y te doy recomendaciones.
            </p>
            {/* Suggestion chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left text-sm px-4 py-3 rounded-xl border border-gray-200 hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors text-gray-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((m, i) => <MessageBubble key={i} message={m} />)}

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Bot size={16} className="text-gray-600" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-primary" />
              <span className="text-sm text-gray-500">Analizando tus datos...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-100 p-4 flex-shrink-0">
        {messages.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
            {SUGGESTIONS.slice(0, 3).map((s) => (
              <button key={s} onClick={() => sendMessage(s)} className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-gray-100 hover:bg-primary/10 hover:text-primary text-gray-600 transition-colors whitespace-nowrap">
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta... (Enter para enviar)"
            rows={1}
            disabled={loading}
            className="input flex-1 resize-none min-h-[44px] max-h-32 py-2.5 disabled:opacity-50"
            style={{ height: "auto" }}
            onInput={(e) => {
              const el = e.target as HTMLTextAreaElement;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 128) + "px";
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-11 h-11 flex-shrink-0 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">Impulsado por Claude · Los datos son de tu clínica en tiempo real</p>
      </div>
    </div>
  );
}
