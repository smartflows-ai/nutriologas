"use client";
// src/components/chat/ChatAssistant.tsx
import { useState, useRef, useEffect } from "react";

import {
  Send,
  Bot,
  User,
  Sparkles,
  TrendingUp,
  ShoppingBag,
  Package,
  Globe,
  ArrowUpRight,
  AlertTriangle,
  Zap,
  Calendar,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "@/i18n";
import { translateApiError } from "@/i18n/validation";
import { toast } from "sonner";
import { formatPrice, localeFor } from "@/lib/utils";
import CreditsDrawer from "@/components/admin/CreditsDrawer";
import AssistantThinkingIndicator from "./AssistantThinkingIndicator";

export interface AssistantMetrics {
  monthlySales: number;
  paidOrdersCount: number;
  pendingOrdersCount: number;
  activeProductsCount: number;
  activeCampaignsCount: number;
  todayAppointmentsCount?: number;
  pendingAppointmentsCount?: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

function MessageBubble({
  message,
  tenantName,
}: {
  message: Message;
  tenantName?: string;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm relative ${
          isUser
            ? "bg-gray-900 text-white dark:bg-gray-800 border border-gray-700"
            : "bg-primary text-white"
        }`}
      >
        {isUser ? (
          <User size={16} />
        ) : (
          <>
            <Bot size={18} />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white dark:border-gray-900" />
          </>
        )}
      </div>

      {/* Bubble */}
      <div
        className={`text-sm leading-relaxed ${
          isUser
            ? "max-w-[78%] bg-gray-900 text-white dark:bg-gray-800 border border-gray-800 dark:border-gray-700 rounded-xl rounded-tr-xs px-4 py-3 shadow-sm"
            : "max-w-[85%] bg-white dark:bg-gray-900 border border-gray-200/90 dark:border-gray-800 text-gray-800 dark:text-gray-100 rounded-xl rounded-tl-xs p-4 shadow-sm"
        }`}
      >
        {!isUser && (
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-800 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white">
              <span>Newy AI</span>
              {tenantName && (
                <span className="text-gray-400 font-normal">· {tenantName}</span>
              )}
              <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-primary rounded-full border border-gray-200 dark:border-gray-800">
                Datos Reales
              </span>
            </div>
          </div>
        )}

        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-base font-semibold mt-3 mb-1.5 text-gray-900 dark:text-white">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-sm font-semibold mt-2.5 mb-1 text-gray-900 dark:text-white">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-xs font-semibold mt-2 mb-1 text-primary">
                  {children}
                </h3>
              ),
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => (
                <strong className="font-semibold text-gray-900 dark:text-white">
                  {children}
                </strong>
              ),
              em: ({ children }) => <em className="italic">{children}</em>,
              ul: ({ children }) => (
                <ul className="list-disc list-inside space-y-1 mb-2 pl-1 text-gray-700 dark:text-gray-300">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside space-y-1 mb-2 pl-1 text-gray-700 dark:text-gray-300">
                  {children}
                </ol>
              ),
              li: ({ children }) => <li className="leading-snug">{children}</li>,
              code: ({ inline, children }: any) =>
                inline ? (
                  <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-1.5 py-0.5 font-mono text-xs">
                    {children}
                  </code>
                ) : (
                  <pre className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-xl p-3 font-mono text-xs overflow-x-auto my-2 whitespace-pre-wrap border border-gray-200 dark:border-gray-700">
                    <code>{children}</code>
                  </pre>
                ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-primary/40 bg-gray-50 dark:bg-gray-900 pl-3 py-1 italic text-gray-600 dark:text-gray-300 rounded-r-lg my-2">
                  {children}
                </blockquote>
              ),
              hr: () => <hr className="border-gray-200 dark:border-gray-800 my-3" />,
              table: ({ children }) => (
                <div className="overflow-x-auto my-3 rounded-xl border border-gray-200 dark:border-gray-800">
                  <table className="min-w-full text-xs divide-y divide-gray-200 dark:divide-gray-800">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-gray-50 dark:bg-gray-950 font-semibold text-gray-700 dark:text-gray-300">
                  {children}
                </thead>
              ),
              tbody: ({ children }) => (
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 bg-white dark:bg-gray-900">
                  {children}
                </tbody>
              ),
              tr: ({ children }) => <tr>{children}</tr>,
              th: ({ children }) => (
                <th className="px-3.5 py-2 text-left font-semibold">{children}</th>
              ),
              td: ({ children }) => (
                <td className="px-3.5 py-2 text-gray-600 dark:text-gray-400">
                  {children}
                </td>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-primary hover:opacity-80"
                >
                  {children}
                </a>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

interface ChatAssistantProps {
  tenantName?: string;
  businessInfo?: string;
  tenantSlug?: string;
  initialMetrics?: AssistantMetrics;
  vertical?: string;
  isBookingEnabled?: boolean;
}

export default function ChatAssistant({
  tenantName,
  businessInfo,
  tenantSlug,
  initialMetrics,
  vertical,
  isBookingEnabled,
}: ChatAssistantProps = {}) {
  const { t, lang } = useTranslation();
  const locale = localeFor(lang);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [creditStatus, setCreditStatus] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchCreditStatus = () => {
    fetch("/api/credits")
      .then((r) => r.json())
      .then((d) => {
        if (d.creditStatus) {
          setCreditStatus(d.creditStatus);
          if (d.creditStatus.isExhausted) {
            toast.error(
              t.crm.credits.exhaustedToast
            );
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchCreditStatus();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("recharge") === "success") {
        toast.success(
          t.crm.credits.rechargeSuccess
        );
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    if (creditStatus?.isExhausted) {
      toast.error(
        t.crm.credits.exhaustedToast
      );
      setDrawerOpen(true);
      return;
    }

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
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (res.status === 402) {
        setCreditStatus((prev: any) => ({ ...(prev ?? {}), isExhausted: true }));
        toast.error(
          t.crm.credits.exhaustedToast
        );
        setDrawerOpen(true);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              t.assistantUi.creditsLimitMsg,
          },
        ]);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(translateApiError(t, data.error) || t.assistantUi.processError);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);

      if (data.creditStatus) {
        setCreditStatus(data.creditStatus);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("credits-updated", { detail: data.creditStatus })
          );
        }
      } else {
        fetchCreditStatus();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: t.crm.assistant.chat.error },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };


  return (
    <div className="flex-1 flex flex-col h-full min-h-0">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-200/80 dark:border-gray-800/80 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Bot size={22} className="text-primary" />
            {t.crm.assistant.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t.crm.assistant.subtitle}
            {tenantName && <span className="ml-1 text-gray-400">· {tenantName}</span>}
          </p>
        </div>
      </div>

      {/* ── Business KPI Snapshot Bar (Top CRM Metrics) ── */}
      {initialMetrics && (
        <div className={`grid grid-cols-2 ${isBookingEnabled ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-3 mb-3 shrink-0`}>
          {/* Card 1: Ventas del Mes */}
          <button
            onClick={() =>
              sendMessage(
                t.crm.assistant.chat.suggestions[0]
              )
            }
            className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 text-left hover:border-primary transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t.crm.assistant.kpis.monthlySales}
              </span>
              <span className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-primary transition-transform">
                <TrendingUp size={14} />
              </span>
            </div>
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {formatPrice(initialMetrics.monthlySales, locale)}
            </p>
            <div className="flex items-center justify-between mt-1 text-[11px] text-gray-400">
              <span>
                {initialMetrics.paidOrdersCount}{" "}
                {t.crm.assistant.kpis.paidOrders}
              </span>
              <span className="text-primary font-semibold inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                Analizar <ArrowUpRight size={11} />
              </span>
            </div>
          </button>

          {/* Card 2: Pedidos Pendientes */}
          <button
            onClick={() =>
              sendMessage(
                t.crm.assistant.chat.suggestions[2]
              )
            }
            className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 text-left hover:border-primary transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t.crm.assistant.kpis.pendingOrders}
              </span>
              <span className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-primary transition-transform">
                <ShoppingBag size={14} />
              </span>
            </div>
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {initialMetrics.pendingOrdersCount}
            </p>
            <div className="flex items-center justify-between mt-1 text-[11px] text-gray-400">
              <span>{t.assistantUi.pendingLabel}</span>
              <span className="text-primary font-semibold inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                Revisar <ArrowUpRight size={11} />
              </span>
            </div>
          </button>

          {/* Card 3: Catálogo Activo */}
          <button
            onClick={() =>
              sendMessage(
                t.crm.assistant.chat.suggestions[1]
              )
            }
            className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 text-left hover:border-secondary transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {vertical === "HEALTH" ? t.assistantUi.activeServices : t.crm.assistant.kpis.activeCatalog}
              </span>
              <span className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-secondary transition-transform">
                <Package size={14} />
              </span>
            </div>
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {initialMetrics.activeProductsCount}
            </p>
            <div className="flex items-center justify-between mt-1 text-[11px] text-gray-400">
              <span>{t.assistantUi.availableLabel}</span>
              <span className="text-secondary font-semibold inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                Rotación <ArrowUpRight size={11} />
              </span>
            </div>
          </button>

          {/* Card 4: Campañas Sociales */}
          <button
            onClick={() =>
              sendMessage(
                t.assistantUi.promptCampaigns
              )
            }
            className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 text-left hover:border-primary transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t.crm.assistant.kpis.activeCampaigns}
              </span>
              <span className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-primary transition-transform">
                <Globe size={14} />
              </span>
            </div>
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {initialMetrics.activeCampaignsCount}
            </p>
            <div className="flex items-center justify-between mt-1 text-[11px] text-gray-400">
              <span>{t.assistantUi.automatedLabel}</span>
              <span className="text-primary dark:text-primary font-semibold inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                Estrategia <ArrowUpRight size={11} />
              </span>
            </div>
          </button>

          {/* Card 5: Citas / Consultas (si isBookingEnabled) */}
          {isBookingEnabled && (
            <button
              onClick={() =>
                sendMessage(
                  vertical === "HEALTH"
                    ? t.assistantUi.promptAppointmentsHealth
                    : t.assistantUi.promptAppointments
                )
              }
              className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 text-left hover:border-accent transition-all group col-span-2 lg:col-span-1"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {vertical === "HEALTH" ? t.assistantUi.todayAppointmentsHealth : t.assistantUi.scheduleAppointments}
                </span>
                <span className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-accent transition-transform">
                  <Calendar size={14} />
                </span>
              </div>
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                {initialMetrics.todayAppointmentsCount ?? 0}
              </p>
              <div className="flex items-center justify-between mt-1 text-[11px] text-gray-400">
                <span>{initialMetrics.pendingAppointmentsCount ?? 0} {t.assistantUi.pendingSuffix}</span>
                <span className="text-accent font-semibold inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  Agenda <ArrowUpRight size={11} />
                </span>
              </div>
            </button>
          )}
        </div>
      )}

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200/90 dark:border-gray-800 overflow-hidden min-h-0 shadow-sm">
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 min-h-0">
          {/* Welcome State */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-6">
              <div className="w-14 h-14 bg-gray-50 dark:bg-gray-900 rounded-xl flex items-center justify-center mb-3 shadow-inner">
                <Sparkles size={28} className="text-primary" />
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-white text-lg mb-1.5">
                {t.crm.assistant.chat.welcomeTitle}
              </h2>
              <p className="text-gray-500 text-sm mb-6 max-w-md leading-relaxed">
                {t.crm.assistant.chat.welcomeDesc}
              </p>

              {/* Categorized Suggestion Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl text-left">
                {(isBookingEnabled
                  ? [
                      vertical === "HEALTH"
                        ? t.assistantUi.promptAppointmentsHealth
                        : t.assistantUi.promptAppointments,
                      ...t.crm.assistant.chat.suggestions,
                    ]
                  : t.crm.assistant.chat.suggestions
                ).map((s, idx) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="flex items-center justify-between text-xs font-medium px-4 py-3 rounded-xl border border-gray-200/80 dark:border-gray-800 hover:border-primary hover:bg-primary/5 hover:text-primary text-gray-700 dark:text-gray-300 transition-all shadow-xs group"
                  >
                    <span>{s}</span>
                    <ArrowUpRight
                      size={14}
                      className="text-gray-400 group-hover:text-primary transition-colors shrink-0 ml-2"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message List */}
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} tenantName={tenantName} />
          ))}

          {/* Progressive Thinking Indicator */}
          {loading && (
            <AssistantThinkingIndicator
              tenantName={tenantName}
              businessInfo={businessInfo}
              tenantSlug={tenantSlug}
            />
          )}
          <div ref={bottomRef} />
        </div>

        {/* Exhausted credits banner */}
        {creditStatus?.isExhausted && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-900/50 p-3 px-4 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <AlertTriangle
                size={16}
                className="text-amber-600 dark:text-amber-400 shrink-0"
              />
              <span>
                {t.crm.credits.exhaustedToast}
              </span>
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs transition-colors shrink-0 shadow-sm"
            >
              <Zap size={13} className="fill-white" />
              {t.crm.credits.recharge}
            </button>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-gray-100 dark:border-gray-800 p-4 flex-shrink-0 bg-gray-50/50 dark:bg-gray-950/30">
          {messages.length > 0 && !creditStatus?.isExhausted && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
              {t.crm.assistant.chat.suggestions.slice(0, 4).map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 hover:border-primary hover:text-primary text-gray-600 dark:text-gray-300 transition-colors whitespace-nowrap shadow-xs"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2.5 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                creditStatus?.isExhausted
                  ? t.assistantUi.creditsPlaceholder
                  : t.crm.assistant.chat.placeholder
              }
              rows={1}
              disabled={loading || creditStatus?.isExhausted}
              className="input flex-1 resize-none min-h-[44px] max-h-32 py-2.5 rounded-xl disabled:opacity-50 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              style={{ height: "auto" }}
              onInput={(e) => {
                const el = e.target as HTMLTextAreaElement;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 128) + "px";
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading || creditStatus?.isExhausted}
              className="w-11 h-11 flex-shrink-0 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors shadow-sm"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 text-center">
            {t.crm.assistant.chat.footerText}
          </p>
        </div>

        {drawerOpen && creditStatus && (
          <CreditsDrawer
            status={creditStatus}
            onClose={() => setDrawerOpen(false)}
            onRefresh={fetchCreditStatus}
          />
        )}
      </div>
    </div>
  );
}
