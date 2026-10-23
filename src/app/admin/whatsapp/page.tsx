"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, Settings, Send, User, Bot, BotOff, RefreshCw, ChevronLeft, X, Check, PanelLeftClose, PanelLeftOpen, Trash2, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "@/i18n";
import { translateApiError } from "@/i18n/validation";
import PendingConfirmations from "@/components/admin/PendingConfirmations";
import ReminderMessagesCard from "@/components/admin/ReminderMessagesCard";
import ReminderSettingsCard from "@/components/admin/ReminderSettingsCard";

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
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"chats" | "confirmations" | "settings">("chats");
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chatListCollapsed, setChatListCollapsed] = useState(false);
  const [notificationState, setNotificationState] = useState<{ title: string; message: string; type: "error" | "success" } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ chat: any } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sending, setSending] = useState(false);
  const [botBusy, setBotBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const botOn = selectedChat?.botEnabled !== false;

  // A draft belongs to one chat.
  useEffect(() => {
    setDraft("");
  }, [selectedChat?.id]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);

  useEffect(() => {
    fetchData();
  }, []);

  // Keep the chat list (and the open chat's bot state) current without a manual refresh.
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/apps/whatsapp/chats");
        if (!res.ok) return;
        const data = await res.json();
        const fresh: any[] = data.chats || [];
        setChats(fresh);
        setSelectedChat((prev: any) => (prev ? fresh.find((c) => c.id === prev.id) ?? prev : prev));
      } catch (error) {
        console.error("Error refreshing chats:", error);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedChat) {
      // Reset scroll state when switching chats
      prevMessagesLengthRef.current = 0;
      isAtBottomRef.current = true;
      fetchMessages(selectedChat.id);
      const interval = setInterval(() => fetchMessages(selectedChat.id), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedChat]);

  useEffect(() => {
    const isFirstLoad = prevMessagesLengthRef.current === 0 && messages.length > 0;
    const hasNewMessages = messages.length > prevMessagesLengthRef.current;

    if (isFirstLoad) {
      // First load: jump instantly to bottom without animation
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
    } else if (hasNewMessages && isAtBottomRef.current) {
      // New message arrived and user was already at the bottom: follow it
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (!confirmDelete) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) setConfirmDelete(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [confirmDelete, deleting]);

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    // Consider "at bottom" if within 80px of the bottom edge
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

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
        // The open chat follows the list, so a pause from the phone shows in the header too.
        setSelectedChat((prev: any) => (prev ? (data.chats || []).find((c: any) => c.id === prev.id) ?? prev : prev));
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

  // Applies a chat update (flags, last message) to the list and to the open chat.
  const mergeChatState = (update: { id: string } & Record<string, any>) => {
    setChats(prev => prev.map(c => (c.id === update.id ? { ...c, ...update } : c)));
    setSelectedChat((prev: any) => (prev?.id === update.id ? { ...prev, ...update } : prev));
  };

  const showError = (code: string | undefined) => {
    setNotificationState({
      title: t.whatsappUi.errorTitle,
      message: translateApiError(t, code) || t.whatsappUi.errorTitle,
      type: "error",
    });
  };

  const toggleBot = async () => {
    if (!selectedChat) return;
    setBotBusy(true);
    try {
      const res = await fetch(`/api/apps/whatsapp/chats/${selectedChat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botEnabled: !botOn }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      mergeChatState(data.chat);
    } catch (error: any) {
      showError(error?.message);
    } finally {
      setBotBusy(false);
    }
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!selectedChat || !text || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/apps/whatsapp/chats/${selectedChat.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages(prev => [...prev, data.message]);
      setDraft("");
      mergeChatState({ ...data.chat, lastMessage: text });
    } catch (error: any) {
      showError(error?.message);
    } finally {
      setSending(false);
    }
  };

  const requestDeleteChat = (chat: any) => {
    setConfirmDelete({ chat });
  };

  const confirmDeleteChat = async () => {
    if (!confirmDelete) return;
    const chat = confirmDelete.chat;
    setDeleting(true);
    try {
      const res = await fetch(`/api/apps/whatsapp/chats/${chat.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");

      setChats(prev => prev.filter(c => c.id !== chat.id));
      if (selectedChat?.id === chat.id) {
        setSelectedChat(null);
        setMessages([]);
      }
      setConfirmDelete(null);
      setNotificationState({
        title: t.whatsappUi.deletedTitle,
        message: t.crm.whatsapp.modalDeleteDesc2,
        type: "success",
      });
    } catch (error) {
      setConfirmDelete(null);
      setNotificationState({
        title: t.whatsappUi.errorTitle,
        message: t.whatsappUi.deleteError,
        type: "error",
      });
    } finally {
      setDeleting(false);
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
      if (res.ok) {
        setNotificationState({
          title: t.whatsappUi.savedTitle,
          message: t.whatsappUi.savedMsg,
          type: "success"
        });
      }
    } catch (error) {
      setNotificationState({
        title: t.whatsappUi.saveErrorTitle,
        message: t.whatsappUi.saveErrorMsg,
        type: "error"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">{t.whatsappUi.loading}</div>;

  if (!config) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-12 shadow-sm border border-gray-100">
          <MessageSquare className="w-16 h-16 text-primary mx-auto mb-6 opacity-20" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">{t.crm.whatsapp.notConnected}</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">{t.crm.whatsapp.notConnectedDesc}</p>
          <a href="/admin/apps" className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-secondary transition-colors">
            {t.crm.whatsapp.goToApps}
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
          <MessageSquare className="text-primary shrink-0" size={26} />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white leading-none">{t.crm.whatsapp.title}</h1>
            <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-1">● {t.crm.whatsapp.connected} {config.waPhoneNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "chats" && (
            <button
              onClick={() => setChatListCollapsed(c => !c)}
              aria-label={chatListCollapsed ? t.crm.whatsapp.showList : t.crm.whatsapp.hideList}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={chatListCollapsed ? t.crm.whatsapp.showList : t.crm.whatsapp.hideList}
            >
              {chatListCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={() => { setActiveTab("chats"); setSelectedChat(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'chats' ? 'bg-gray-100 dark:bg-gray-800 text-primary' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100'}`}
          >
            <MessageSquare className="w-4 h-4" /> {t.crm.whatsapp.tabChats}
          </button>
          <button
            onClick={() => { setActiveTab("confirmations"); setSelectedChat(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'confirmations' ? 'bg-gray-100 dark:bg-gray-800 text-primary' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100'}`}
          >
            <Check className="w-4 h-4" /> {t.crm.whatsapp.tabConfirmations}
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-gray-100 dark:bg-gray-800 text-primary' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100'}`}
          >
            <Settings className="w-4 h-4" /> {t.crm.whatsapp.tabSettings}
          </button>
        </div>
      </div>

      {activeTab === "chats" ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Chat List */}
          <div className={`w-full md:w-80 bg-white dark:bg-gray-900 border-r border-gray-200 flex-col flex-shrink-0
            ${chatListCollapsed ? 'hidden' : selectedChat ? 'hidden md:flex' : 'flex'}
          `}>
            <div className="p-4 border-b border-gray-100">
              <button onClick={fetchData} className="w-full flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-secondary transition-colors">
                <RefreshCw className="w-3 h-3" /> {t.crm.whatsapp.updateList}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {chats.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">{t.crm.whatsapp.noChats}</div>
              ) : (
                chats.map(chat => (
                  <div key={chat.id} className="relative group border-b border-gray-50">
                    <button
                      onClick={() => setSelectedChat(chat)}
                      className={`w-full p-4 pr-12 flex items-center gap-3 hover:bg-gray-50 dark:bg-gray-950 transition-colors text-left ${selectedChat?.id === chat.id ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                    >
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 text-gray-400">
                        <User className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{chat.pushName || chat.remoteJid.split('@')[0]}</p>
                        {chat.botEnabled === false && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 mb-0.5">
                            <BotOff size={12} aria-hidden="true" />
                            {t.crm.whatsapp.botBadge}
                          </span>
                        )}
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
                    <button
                      onClick={(e) => { e.stopPropagation(); requestDeleteChat(chat); }}
                      aria-label={t.crm.whatsapp.deleteChat}
                      title={t.crm.whatsapp.deleteChat}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-primary">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedChat.pushName || t.whatsappUi.client}</p>
                    <p className="text-xs text-gray-500">{selectedChat.remoteJid.split('@')[0]}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-xs text-gray-500">{botOn ? t.crm.whatsapp.botOnState : t.crm.whatsapp.botOffState}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={botOn}
                      aria-label={t.crm.whatsapp.botToggleLabel}
                      onClick={toggleBot}
                      disabled={botBusy}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${botOn ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`}
                    >
                      <span className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${botOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>

                {/* Messages List */}
                <div
                  ref={messagesContainerRef}
                  onScroll={handleMessagesScroll}
                  className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-950"
                >
                  {messages.map((msg, i) => (
                    <div key={msg.id || i} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] md:max-w-[75%] px-4 py-2 rounded-xl text-sm shadow-sm ${msg.fromMe ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-100'}`}>
                        <div className="prose-chat break-words">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({node, ...props}) => <p className="whitespace-pre-wrap mb-1 last:mb-0 leading-relaxed" {...props} />,
                              a: ({node, ...props}) => <a className="underline font-medium hover:opacity-80 break-all" target="_blank" rel="noopener noreferrer" {...props} />,
                              strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
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
                        <p className={`text-xs mt-1 text-right ${msg.fromMe ? 'text-primary' : 'text-gray-400'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                
                {/* Composer: the owner can write to the contact; sending pauses the bot */}
                <div className="p-3 bg-gray-50 dark:bg-gray-950 border-t border-gray-100 space-y-2">
                  {!botOn && (
                    <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <BotOff size={12} aria-hidden="true" />
                        {selectedChat.botPausedReason === "owner_reply" ? t.crm.whatsapp.botPausedByOwner : t.crm.whatsapp.botPausedManual}
                      </span>
                      <button
                        type="button"
                        onClick={toggleBot}
                        disabled={botBusy}
                        className="text-primary underline underline-offset-2 disabled:opacity-50"
                      >
                        {t.crm.whatsapp.resumeBot}
                      </button>
                    </div>
                  )}
                  <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-end gap-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      rows={1}
                      maxLength={4096}
                      disabled={sending}
                      placeholder={t.crm.whatsapp.composerPlaceholder}
                      aria-label={t.crm.whatsapp.composerPlaceholder}
                      className="flex-1 resize-none rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      aria-label={t.crm.whatsapp.sendMessage}
                      title={t.crm.whatsapp.sendMessage}
                      className="p-2.5 rounded-lg bg-primary text-white disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                  <p className="text-[11px] text-gray-400">{t.crm.whatsapp.composerHint}</p>
                </div>
              </>
            ) : (
              <div className="text-center p-12">
                <MessageSquare className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                <p className="text-gray-400 text-sm italic">{t.crm.whatsapp.selectChat}</p>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "confirmations" ? (
        <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full">
          <PendingConfirmations />
        </div>
      ) : (
        /* Settings Tab */
        <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full">
          <form onSubmit={handleSaveConfig} className="bg-white dark:bg-gray-950 p-8 md:p-10 rounded-xl border border-gray-100 dark:border-gray-800 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* Left Side: Parameters */}
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                    <RefreshCw className="w-5 h-5 text-primary" /> {t.crm.whatsapp.settingsTitle}
                  </h3>
                  <p className="text-sm text-gray-500 mb-8 font-medium">{t.crm.whatsapp.settingsDesc}</p>
                  
                  <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-6">
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t.crm.whatsapp.tempLabel}</label>
                      <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full text-xs font-semibold ring-1 ring-green-200 dark:ring-green-800">
                        {config.waTemperature}
                      </span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.1" 
                      value={config.waTemperature}
                      onChange={(e) => setConfig({ ...config, waTemperature: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-primary mb-2"
                    />
                    <div className="flex justify-between text-xs text-gray-400 font-semibold ">
                      <span>{t.crm.whatsapp.conservative}</span>
                      <span>{t.crm.whatsapp.creative}</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-xl border border-primary/10 dark:border-primary/20">
                  <h4 className="text-sm font-semibold text-primary dark:text-primary flex items-center gap-2 mb-2">
                    <Lightbulb size={16} className="text-primary dark:text-primary" />
                    <span>{t.crm.whatsapp.tipTitle}</span>
                  </h4>
                  <p className="text-xs text-primary dark:text-primary leading-relaxed">
                    {t.crm.whatsapp.tipDesc}
                  </p>
                </div>
              </div>

              {/* Right Side: Identity */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                    <Bot className="w-5 h-5 text-primary" /> {t.crm.whatsapp.identityTitle}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4 font-medium">{t.crm.whatsapp.identityDesc}</p>
                  
                  <textarea 
                    className="w-full h-64 p-5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none text-gray-700 dark:text-gray-200 font-mono text-sm shadow-inner transition-all"
                    placeholder={t.crm.whatsapp.identityPlaceholder}
                    value={config.waContext || ""}
                    onChange={(e) => setConfig({ ...config, waContext: e.target.value })}
                  />
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                    <Check className="w-3 h-3 text-primary" /> {t.crm.whatsapp.identityNote}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-10 border-t border-gray-100 dark:border-gray-800">
              <button 
                type="submit" disabled={saving}
                className="w-full md:w-auto md:px-12 bg-primary text-white py-4 rounded-xl font-semibold hover:bg-secondary transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>{t.crm.whatsapp.saveBtn}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 space-y-8">
            <ReminderSettingsCard />
            <ReminderMessagesCard />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => { if (!deleting) setConfirmDelete(null); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-chat-title"
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-lg w-full max-w-sm p-8 text-center border border-gray-100 dark:border-gray-800 animate-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 ring-2 ring-red-50 dark:ring-red-900/10">
              <Trash2 size={28} />
            </div>
            <h3 id="delete-chat-title" className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t.crm.whatsapp.modalDeleteTitle}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-2 leading-relaxed">
              {t.crm.whatsapp.modalDeleteDesc1}{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {confirmDelete.chat.pushName || confirmDelete.chat.remoteJid?.split('@')[0]}
              </span>
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mb-8 leading-relaxed">
              {t.crm.whatsapp.modalDeleteDesc2}
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.crm.whatsapp.cancel}
              </button>
              <button
                disabled={deleting}
                onClick={confirmDeleteChat}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t.crm.whatsapp.deleting}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>{t.crm.whatsapp.delete}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Notification Modal */}
       {notificationState && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg w-full max-w-sm p-8 text-center border border-gray-100 dark:border-gray-800">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${notificationState.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
              {notificationState.type === 'error' ? <X size={32} /> : <Check size={32} />}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{notificationState.title}</h3>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">{notificationState.message}</p>
            <button
              className="px-6 py-3 w-full text-sm font-semibold text-white bg-gray-900 dark:bg-gray-800 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-700 transition-all "
              onClick={() => setNotificationState(null)}
            >
              {t.integrationsUi.understood}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
