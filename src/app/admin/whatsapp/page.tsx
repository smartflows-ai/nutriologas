"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, Settings, Send, User, Bot, RefreshCw, ChevronLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// WhatsApp text formatting normalizer to Standard Markdown
const parseWhatsAppToMarkdown = (text: string) => {
  if (!text) return "";
  let md = text;
  // Convert *bold* (WhatsApp) to **bold** (Markdown), ignore already **bold**
  md = md.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '**$1**');
  // Convert _italic_ to *italic*
  md = md.replace(/(?<!\_)\_(?!\_)(.+?)(?<!\_)\_(?!\_)/g, '*$1*');
  // Convert ~strikethrough~ to ~~strikethrough~~
  md = md.replace(/(?<!\~)\~(?!\~)(.+?)(?<!\~)\~(?!\~)/g, '~~$1~~');
  return md;
};

export default function WhatsAppPage() {
  const [activeTab, setActiveTab] = useState<"chats" | "settings">("chats");
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      const interval = setInterval(() => fetchMessages(selectedChat.id), 5000); // Polling cada 5s
      return () => clearInterval(interval);
    }
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [confRes, chatsRes] = await Promise.all([
        fetch("/api/apps/whatsapp/config"),
        fetch("/api/apps/whatsapp/chats")
      ]);
      
      if (confRes.ok) setConfig(await confRes.json());
      if (chatsRes.ok) {
        const data = await chatsRes.json();
        setChats(data.chats || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const res = await fetch(`/api/apps/whatsapp/messages?chatId=${chatId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/apps/whatsapp/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waTemperature: config.waTemperature,
          waContext: config.waContext
        }),
      });
      if (res.ok) alert("Configuración guardada");
    } catch (error) {
      alert("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando WhatsApp...</div>;

  if (!config) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-12 shadow-sm border border-gray-100">
          <MessageSquare className="w-16 h-16 text-green-500 mx-auto mb-6 opacity-20" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">WhatsApp no conectado</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Debes conectar tu cuenta de WhatsApp desde la sección de Apps antes de poder gestionarlo aquí.</p>
          <a href="/admin/apps" className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors">
            Ir a Apps
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col bg-gray-50 dark:bg-gray-950 rounded-xl overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-none">Gestión de WhatsApp</h1>
            <p className="text-sm text-green-600 font-medium mt-1">● Conectado: {config.waPhoneNumber}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => { setActiveTab("chats"); setSelectedChat(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'chats' ? 'bg-green-50 text-green-700' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100'}`}
          >
            <MessageSquare className="w-4 h-4" /> Conversaciones
          </button>
          <button 
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-green-50 text-green-700' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100'}`}
          >
            <Settings className="w-4 h-4" /> Configuración IA
          </button>
        </div>
      </div>

      {activeTab === "chats" ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Chat List */}
          <div className={`w-full md:w-80 bg-white dark:bg-gray-900 border-r border-gray-200 flex flex-col ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-gray-100">
              <button onClick={fetchData} className="w-full flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-green-600 transition-colors">
                <RefreshCw className="w-3 h-3" /> Actualizar lista
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {chats.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No hay conversaciones registradas</div>
              ) : (
                chats.map(chat => (
                  <button 
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`w-full p-4 flex items-center gap-3 border-b border-gray-50 hover:bg-gray-50 dark:bg-gray-950 transition-colors text-left ${selectedChat?.id === chat.id ? 'bg-green-50' : ''}`}
                  >
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 text-gray-400">
                      <User className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white truncate">{chat.pushName || chat.remoteJid.split('@')[0]}</p>
                      <div className="text-sm text-gray-500 line-clamp-1 break-all">
                        <ReactMarkdown 
                          components={{
                            p: ({node, ...props}) => <span {...props} />,
                            strong: ({node, ...props}) => <strong className="font-semibold text-gray-700 dark:text-gray-200" {...props} />,
                            em: ({node, ...props}) => <em className="italic" {...props} />,
                            br: () => <span className="mx-1 text-gray-300">·</span>,
                            ul: ({node, ...props}) => <span {...props} />,
                            li: ({node, ...props}) => <span className="mr-1" {...props} />
                          }}
                        >
                          {parseWhatsAppToMarkdown(chat.lastMessage || "")}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className={`flex-1 flex flex-col bg-white dark:bg-gray-900 ${!selectedChat ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                  <button onClick={() => setSelectedChat(null)} className="md:hidden p-2 text-gray-400">
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{selectedChat.pushName || "Cliente"}</p>
                    <p className="text-xs text-gray-500">{selectedChat.remoteJid.split('@')[0]}</p>
                  </div>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-950">
                  {messages.map((msg, i) => (
                    <div key={msg.id || i} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] md:max-w-[75%] px-4 py-2 rounded-2xl text-sm shadow-sm ${msg.fromMe ? 'bg-green-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-100'}`}>
                        <div className="prose-chat break-words">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({node, ...props}) => <p className="whitespace-pre-wrap mb-1 last:mb-0 leading-relaxed" {...props} />,
                              a: ({node, ...props}) => <a className="underline font-medium hover:opacity-80 break-all" target="_blank" rel="noopener noreferrer" {...props} />,
                              strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                              em: ({node, ...props}) => <em className="italic" {...props} />,
                              del: ({node, ...props}) => <del className="line-through opacity-70" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc pl-4 my-1 space-y-1" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal pl-4 my-1 space-y-1" {...props} />,
                              li: ({node, ...props}) => <li className="pl-1" {...props} />,
                              code: ({node, inline, ...props}: any) => inline 
                                ? <code className="bg-black/10 rounded px-1.5 py-0.5 text-xs font-mono" {...props} />
                                : <pre className="bg-black/10 p-3 rounded-xl text-xs overflow-x-auto my-2"><code className="font-mono" {...props} /></pre>
                            }}
                          >
                            {parseWhatsAppToMarkdown(msg.content)}
                          </ReactMarkdown>
                        </div>
                        <p className={`text-[10px] mt-1 text-right ${msg.fromMe ? 'text-green-100' : 'text-gray-400'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                
                {/* Info Footer */}
                <div className="p-3 bg-gray-50 dark:bg-gray-950 border-t border-gray-100 text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Respondiendo automáticamente con IA de Smart Flows</p>
                </div>
              </>
            ) : (
              <div className="text-center p-12">
                <MessageSquare className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                <p className="text-gray-400 text-sm italic">Selecciona una conversación para ver los mensajes</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Settings Tab */
        <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
          <form onSubmit={handleSaveConfig} className="space-y-8 bg-white dark:bg-gray-900 p-8 rounded-xl shadow-sm border border-gray-100">
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-green-500" /> Temperatura del Bot
                </label>
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold">{config.waTemperature}</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.1" 
                value={config.waTemperature}
                onChange={(e) => setConfig({ ...config, waTemperature: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>Preciso y técnico</span>
                <span>Creativo y amigable</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-50">
              <label className="text-lg font-bold text-gray-900 dark:text-white block mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5 text-green-500" /> Instrucciones del Agente (Contexto)
              </label>
              <p className="text-sm text-gray-500 mb-4 bg-gray-50 dark:bg-gray-950 p-3 rounded-lg border-l-4 border-green-500 italic">
                Usa este espacio para darle personalidad a tu bot. Ejemplo: "Responde como una nutricionista experta, usa emojis, no des precios hasta que pregunten".
              </p>
              <textarea 
                className="w-full h-48 p-4 bg-gray-50 dark:bg-gray-950 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-700 dark:text-gray-200 font-mono text-sm"
                placeholder="Identifícate como asistente de la clínica..."
                value={config.waContext || ""}
                onChange={(e) => setConfig({ ...config, waContext: e.target.value })}
              />
            </div>

            <div className="pt-6">
              <button 
                type="submit" disabled={saving}
                className="w-full bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-100 disabled:opacity-50"
              >
                {saving ? "Guardando..." : <><Send className="w-5 h-5" /> Guardar Configuración Personalizada</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
