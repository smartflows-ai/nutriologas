"use client";
// src/app/admin/facebook/page.tsx
// Social Campaign Manager — create/manage AI-driven social media campaigns

import { useState, useEffect } from "react";
import {
  Facebook, Instagram, Sparkles, Loader2, X, Check, Plus,
  ChevronDown, Zap, Target, MessageSquare, Tag, Calendar,
  Pause, Play, Trash2, Edit3, Clock, Globe, LayoutList, History, Search, Filter,
  ExternalLink, Image as ImageIcon, FileText
} from "lucide-react";
import CampaignMetrics from "@/components/crm/CampaignMetrics";
import Pagination from "@/components/admin/Pagination";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "@/i18n";

// ── Types ──────────────────────────────────────────────────────────────────
interface Product {
  id: string; name: string; description: string | null;
  price: number; images: string[];
}

interface FacebookConfig {
  pageName: string; pageId: string;
  allPages: { id: string; name: string }[];
}

interface SocialCampaign {
  id: string; name: string;
  platforms: string[]; productIds: string[];
  campaignGoal: string;
  tone: string; extraContext: string | null;
  frequency: string; isActive: boolean;
  startDate: string; endDate: string;
  nextPostAt: string | null; lastPostedAt: string | null;
  createdAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
const GOALS = [
  { id: "promocion", label: "🎯 Promoción", desc: "Oferta o precio especial" },
  { id: "informativo", label: "📋 Informativo", desc: "Presenta el servicio" },
  { id: "urgencia", label: "⚡ Urgencia", desc: "Cupos / tiempo limitado" },
  { id: "testimonio", label: "⭐ Testimonio", desc: "Basado en resultados" },
  { id: "educativo", label: "🎓 Educativo", desc: "Tips de valor" },
];

const TONES = [
  { id: "profesional", label: "Profesional" },
  { id: "cercano", label: "Cercano" },
  { id: "motivacional", label: "Motivacional" },
  { id: "urgente", label: "Urgente" },
];

const FREQUENCIES = [
  { id: "DAILY", label: "Diario", desc: "1 post por día" },
  { id: "EVERY_3_DAYS", label: "Cada 3 días", desc: "~10 posts/mes" },
  { id: "WEEKLY", label: "Semanal", desc: "4 posts/mes" },
  { id: "BIWEEKLY", label: "Quincenal", desc: "2 posts/mes" },
  { id: "MONTHLY", label: "Mensual", desc: "1 post/mes" },
];

const FREQ_LABELS: Record<string, string> = {
  DAILY: "Diario", EVERY_3_DAYS: "Cada 3 días",
  WEEKLY: "Semanal", BIWEEKLY: "Quincenal", MONTHLY: "Mensual",
};

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function toDateLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function SocialCampaignPage() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<FacebookConfig | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "form" | "history">("list");
  const [editId, setEditId] = useState<string | null>(null);

  // ── History state ────────────────────────────────────────────────────────
  const [history, setHistory] = useState<any[]>([]);
  const [histPage, setHistPage] = useState(1);
  const [histTotalPages, setHistTotalPages] = useState(1);
  const [histLoading, setHistLoading] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterFreq, setFilterFreq] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [selectedPost, setSelectedPost] = useState<any | null>(null);

  // ── Form state ───────────────────────────────────────────────────────────
  const [formName, setFormName] = useState("");
  const [formPlatforms, setFormPlatforms] = useState<string[]>(["FACEBOOK"]);
  const [formProductIds, setFormProductIds] = useState<string[]>([]);
  const [formGoal, setFormGoal] = useState("promocion");
  const [formTone, setFormTone] = useState("cercano");
  const [formContext, setFormContext] = useState("");
  const [formFrequency, setFormFrequency] = useState("WEEKLY");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Notification
  const [notif, setNotif] = useState<{ msg: string; ok: boolean } | null>(null);

  // Delete confirmation modal
  const [confirmDelete, setConfirmDelete] = useState<SocialCampaign | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadAll(); }, []);

  // ESC key closes the delete modal (when not in flight)
  useEffect(() => {
    if (!confirmDelete) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) setConfirmDelete(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [confirmDelete, deleting]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [fbRes, prodRes, campRes] = await Promise.all([
        fetch("/api/apps/facebook/config"),
        fetch("/api/apps/facebook/products"),
        fetch("/api/campaigns/social"),
      ]);
      if (fbRes.ok) setConfig(await fbRes.json());
      if (prodRes.ok) { const d = await prodRes.json(); setProducts(d.products ?? []); }
      if (campRes.ok) { const d = await campRes.json(); setCampaigns(d.campaigns ?? []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchHistory = async () => {
    setHistLoading(true);
    try {
      const q = new URLSearchParams({ page: histPage.toString(), limit: "10" });
      if (filterPlatform) q.append("platform", filterPlatform);
      if (filterFreq) q.append("frequency", filterFreq);
      if (filterSearch) q.append("search", filterSearch);
      
      const res = await fetch(`/api/campaigns/social/history?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.posts || []);
        setHistTotalPages(data.totalPages || 1);
      }
    } catch (e) { console.error(e); }
    finally { setHistLoading(false); }
  };

  useEffect(() => {
    if (view === "history") fetchHistory();
  }, [view, histPage, filterPlatform, filterFreq, filterSearch]);

  // ── Save campaign ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formPlatforms.length || !formEndDate || !formContext.trim()) {
      setNotif({ msg: "La plataforma, fin y descripción son obligatorios", ok: false });
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: formName || "Campaña",
        platforms: formPlatforms,
        productIds: formProductIds,
        campaignGoal: formGoal,
        tone: formTone,
        extraContext: formContext || undefined,
        frequency: formFrequency,
        startDate: formStartDate || undefined,
        endDate: formEndDate,
      };
      const url = editId ? `/api/campaigns/social/${editId}` : "/api/campaigns/social";
      const method = editId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (res.ok) {
        setNotif({ msg: editId ? "Campaña actualizada" : "Campaña creada", ok: true });
        resetForm();
        setView("list");
        loadAll();
      } else {
        const d = await res.json();
        setNotif({ msg: d.error ?? "Error", ok: false });
      }
    } catch { setNotif({ msg: "Error inesperado", ok: false }); }
    finally { setSaving(false); }
  };

  // ── Toggle active ─────────────────────────────────────────────────────────
  const toggleActive = async (id: string, current: boolean) => {
    await fetch(`/api/campaigns/social/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    loadAll();
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const requestDeleteCampaign = (campaign: SocialCampaign) => {
    setConfirmDelete(campaign);
  };

  const confirmDeleteCampaign = async () => {
    if (!confirmDelete) return;
    const campaign = confirmDelete;
    setDeleting(true);
    try {
      const res = await fetch(`/api/campaigns/social/${campaign.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setConfirmDelete(null);
      setNotif({ msg: "Campaña eliminada", ok: true });
      loadAll();
    } catch {
      setConfirmDelete(null);
      setNotif({ msg: "Error al eliminar la campaña", ok: false });
    } finally {
      setDeleting(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (c: SocialCampaign) => {
    setEditId(c.id);
    setFormName(c.name); setFormPlatforms(c.platforms);
    setFormProductIds(c.productIds);
    setFormGoal(c.campaignGoal); setFormTone(c.tone);
    setFormContext(c.extraContext ?? ""); setFormFrequency(c.frequency);
    setFormStartDate(toDateLocal(c.startDate));
    setFormEndDate(toDateLocal(c.endDate));
    setView("form");
  };

  const resetForm = () => {
    setEditId(null); setFormName(""); setFormPlatforms(["FACEBOOK"]);
    setFormProductIds([]); setFormGoal("promocion");
    setFormTone("cercano"); setFormContext(""); setFormFrequency("WEEKLY");
    setFormStartDate(""); setFormEndDate("");
  };

  const togglePlatform = (p: string) =>
    setFormPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const toggleProduct = (id: string) =>
    setFormProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-primary" size={36} />
    </div>
  );

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!config) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-20 h-20 bg-primary/10 dark:bg-primary/20 rounded-3xl flex items-center justify-center mb-6">
        <Facebook className="w-10 h-10 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Facebook no conectado</h1>
      <p className="text-gray-500 mb-8 max-w-sm">Conecta tu página desde Apps para crear campañas.</p>
      <a href="/admin/apps" className="btn-primary inline-flex items-center gap-2 px-6 py-3">
        <Facebook size={18} /> Conectar Facebook
      </a>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.crm.social.title}</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1 ml-12">
            {t.crm.social.subtitle}
          </p>
        </div>
        {view === "list" && (
          <button
            onClick={() => { resetForm(); setView("form"); }}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2.5"
          >
            <Plus size={16} /> {t.crm.social.newCampaign}
          </button>
        )}
      </div>

      {/* ── TABS ──────────────────────────────────────────────────────────── */}
      {view !== "form" && (
        <div className="flex items-center gap-1 bg-gray-100/50 dark:bg-gray-800/50 p-1 rounded-xl w-fit mb-6 border border-gray-200 dark:border-gray-800">
          <button onClick={() => setView("list")} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${view === "list" ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm border border-gray-200/50 dark:border-gray-700/50" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
            <LayoutList size={16} /> {t.crm.social.tabList}
          </button>
          <button onClick={() => setView("history")} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${view === "history" ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm border border-gray-200/50 dark:border-gray-700/50" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
            <History size={16} /> {t.crm.social.tabHistory}
          </button>
        </div>
      )}

      {/* ── LIST VIEW ──────────────────────────────────────────────────────── */}
      {view === "list" && (
        <div className="space-y-4">
          {campaigns.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Sparkles size={40} className="mx-auto mb-4 opacity-30" />
              <p className="font-medium">{t.crm.social.noCampaigns}</p>
              <p className="text-sm mt-1">{t.crm.social.noCampaignsDesc}</p>
            </div>
          )}
          {campaigns.map((c) => (
            <div key={c.id} className={`bg-white dark:bg-gray-900 rounded-2xl border p-5 shadow-sm transition-all ${c.isActive ? "border-gray-200 dark:border-gray-800" : "border-gray-100 dark:border-gray-900 opacity-60"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{c.name}</h3>
                    {c.isActive ? (
                      <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">{t.crm.social.active}</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 dark:bg-gray-800 px-2 py-0.5 rounded-full font-medium">{t.crm.social.paused}</span>
                    )}
                  </div>

                  {/* Platforms */}
                  <div className="flex items-center gap-2 mb-2">
                    {c.platforms.includes("FACEBOOK") && (
                      <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400"><Facebook size={12} /> Facebook</span>
                    )}
                    {c.platforms.includes("INSTAGRAM") && (
                      <span className="flex items-center gap-1 text-xs text-pink-600 dark:text-pink-400"><Instagram size={12} /> Instagram</span>
                    )}
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{FREQ_LABELS[c.frequency]}</span>
                    {c.productIds.length > 0 && (
                      <><span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">{c.productIds.length} {t.crm.social.productsCount}</span></>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {t.crm.social.start} {formatDate(c.startDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {t.crm.social.end} {formatDate(c.endDate)}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {t.crm.social.next} {formatDate(c.nextPostAt)}
                    </span>
                    {c.lastPostedAt && (
                      <span>{t.crm.social.last} {formatDate(c.lastPostedAt)}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(c)} title={t.crm.social.edit}
                    className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg transition-all">
                    <Edit3 size={15} />
                  </button>
                  <button onClick={() => toggleActive(c.id, c.isActive)} title={c.isActive ? t.crm.social.pause : t.crm.social.resume}
                    className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all">
                    {c.isActive ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <button onClick={() => requestDeleteCampaign(c)} title={t.crm.social.delete}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── HISTORY VIEW ───────────────────────────────────────────────────── */}
      {view === "history" && (
        <div className="space-y-4">
          <div className="flex flex-col xl:flex-row gap-4 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder={t.crm.social.searchPlaceholder} value={filterSearch} onChange={e => { setFilterSearch(e.target.value); setHistPage(1); }} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {[
                { value: "", label: t.crm.social.allApps },
                { value: "FACEBOOK", label: "Facebook" },
                { value: "INSTAGRAM", label: "Instagram" }
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => { setFilterPlatform(f.value); setHistPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterPlatform === f.value
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              
              <div className="relative ml-2">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <select value={filterFreq} onChange={e => { setFilterFreq(e.target.value); setHistPage(1); }} className="pl-8 pr-8 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 border border-transparent rounded-lg text-sm appearance-none outline-none transition-colors font-medium cursor-pointer">
                  <option value="">{t.crm.social.freqAll}</option>
                  {FREQUENCIES.map(f => (<option key={f.id} value={f.id}>{f.label}</option>))}
                </select>
              </div>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            {histLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 animate-pulse">{t.crm.social.loadingHistory}</p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <History size={40} className="mx-auto mb-4 opacity-30" />
                <p className="font-medium">{t.crm.social.noHistory}</p>
                <p className="text-sm mt-1">{t.crm.social.noHistoryDesc}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.crm.social.colCampaign}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.crm.social.colContent}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-48">{t.crm.social.colPlatforms}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">{t.crm.social.colFreq}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">{t.crm.social.colDate}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {history.map((h) => (
                      <tr
                        key={h.id}
                        onClick={() => setSelectedPost(h)}
                        className="hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors cursor-pointer group"
                      >
                        <td className="px-4 py-4 font-semibold text-gray-900 dark:text-white max-w-[150px] truncate group-hover:text-primary transition-colors">{h.campaign?.name || t.crm.social.deleted}</td>
                        <td className="px-4 py-4 text-gray-600 dark:text-gray-300">
                          <div className="line-clamp-2 max-w-sm whitespace-pre-wrap text-xs">{h.content}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {h.platforms.map((p: string) => p === "FACEBOOK" ? 
                              <span key={p} className="badge bg-blue-50 text-blue-600 dark:bg-blue-900/30 text-[10px]"><Facebook size={10} className="mr-1 inline" />Facebook</span> :
                              <span key={p} className="badge bg-pink-50 text-pink-600 dark:bg-pink-900/30 text-[10px]"><Instagram size={10} className="mr-1 inline" />Instagram</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-gray-500"><span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">{FREQ_LABELS[h.frequency] || h.frequency}</span></td>
                        <td className="px-4 py-4 text-right text-gray-500 text-xs">{formatDate(h.postedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {histTotalPages > 1 && (
            <Pagination currentPage={histPage} totalPages={histTotalPages} onPageChange={setHistPage} />
          )}
        </div>
      )}

      {/* ── FORM VIEW ──────────────────────────────────────────────────────── */}
      {view === "form" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-6">

          {/* Back */}
          <button onClick={() => { resetForm(); setView("list"); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            {t.crm.social.formBack}
          </button>

          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {editId ? t.crm.social.formEditTitle : t.crm.social.formNewTitle}
          </h2>

          {/* Campaign name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.crm.social.formName}</label>
            <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary outline-none" />
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
              <Globe size={14} /> {t.crm.social.formPlatforms}
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => togglePlatform("FACEBOOK")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-all ${formPlatforms.includes("FACEBOOK") ? "border-primary bg-primary/10 dark:bg-primary/20 text-primary" : "border-gray-200 dark:border-gray-700 text-gray-500"}`}>
                <Facebook size={16} /> Facebook
                {formPlatforms.includes("FACEBOOK") && <Check size={14} />}
              </button>
              <button type="button" onClick={() => togglePlatform("INSTAGRAM")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-all ${formPlatforms.includes("INSTAGRAM") ? "border-primary bg-primary/10 dark:bg-primary/20 text-primary" : "border-gray-200 dark:border-gray-700 text-gray-500"}`}>
                <Instagram size={16} /> Instagram
                {formPlatforms.includes("INSTAGRAM") && <Check size={14} />}
              </button>
            </div>
          </div>

          {/* Products multi-select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
              <Tag size={14} /> {t.crm.social.formProducts}
            </label>
            {products.length === 0 ? (
              <p className="text-sm text-gray-400 italic">{t.crm.social.formNoProducts}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {products.map(p => (
                  <button key={p.id} type="button" onClick={() => toggleProduct(p.id)}
                    className={`flex items-center gap-3 text-left p-3 rounded-xl border-2 transition-all ${formProductIds.includes(p.id) ? "border-primary bg-primary/10 dark:bg-primary/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}>
                    {p.images?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">{new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(p.price)}</p>
                    </div>
                    {formProductIds.includes(p.id) && <Check size={14} className="text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Campaign goal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
              <Target size={14} /> {t.crm.social.formGoal}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GOALS.map(g => (
                <button key={g.id} type="button" onClick={() => setFormGoal(g.id)}
                  className={`text-left px-4 py-3 rounded-xl border text-sm transition-all ${formGoal === g.id ? "border-primary bg-primary/10 dark:bg-primary/20 text-primary" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"}`}>
                  <div className="font-medium">{g.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{g.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
              <MessageSquare size={14} /> {t.crm.social.formTone}
            </label>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => (
                <button key={t.id} type="button" onClick={() => setFormTone(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${formTone === t.id ? "border-primary bg-primary/10 dark:bg-primary/20 text-primary" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
              <Calendar size={14} /> {t.crm.social.formFreq}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FREQUENCIES.map(f => (
                <button key={f.id} type="button" onClick={() => setFormFrequency(f.id)}
                  className={`text-left px-3 py-3 rounded-xl border text-sm transition-all ${formFrequency === f.id ? "border-primary bg-primary/10 dark:bg-primary/20 text-primary" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"}`}>
                  <div className="font-medium">{f.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.crm.social.formStartDate}</label>
              <input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary outline-none" />
              <p className="text-xs text-gray-400 mt-1">{t.crm.social.formStartDateHint}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.crm.social.formEndDate}</label>
              <input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} required
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary outline-none" />
              <p className="text-xs text-gray-400 mt-1">{t.crm.social.formEndDateHint}</p>
            </div>
          </div>

          {/* Extra context / Campaign description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
              <Sparkles size={14} /> {t.crm.social.formDesc}
            </label>
            <p className="text-xs text-gray-400 mb-3">
              {t.crm.social.formDescHint}
            </p>

            {/* Example chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                "Promoción por el 8M, 10% de descuento para las primeras 10 en contactar",
                "Campaña del Día de las Madres",
                "Lanzamiento de nuevo producto, quiero generar expectativa",
                "Recordatorio de citas disponibles esta semana",
              ].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setFormContext(example)}
                  className="text-xs px-3 py-1.5 rounded-full border border-primary/30 text-primary bg-primary/10 hover:bg-primary/20 transition-colors text-left"
                >
                  {example.length > 50 ? example.slice(0, 50) + "…" : example}
                </button>
              ))}
            </div>

            <textarea
              value={formContext}
              onChange={e => setFormContext(e.target.value)}
              rows={3}
              placeholder="Ej: Esta campaña es para el Día de las Madres, quiero resaltar nuestro plan de nutrición familiar y ofrecer 15% de descuento a las primeras 5 en agendar cita."
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary outline-none resize-none leading-relaxed"
            />
          </div>

          {/* WhatMe notice */}
          <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-xl flex items-start gap-2.5">
            <span className="text-lg leading-none mt-0.5">💬</span>
            <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: t.crm.social.formWhatsappNote.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
          </div>

          {/* Save */}
          <button onClick={handleSave} disabled={saving || !formPlatforms.length || !formEndDate || !formContext.trim()}
            className="btn-primary w-full py-4 text-base flex justify-center items-center gap-2 disabled:opacity-50">
            {saving ? <><Loader2 size={18} className="animate-spin" /> {t.crm.social.formSavingBtn}</> : <><Zap size={18} /> {editId ? t.crm.social.formSaveBtn : t.crm.social.formCreateBtn}</>}
          </button>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ────────────────────────────────────── */}
      {confirmDelete && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => { if (!deleting) setConfirmDelete(null); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-campaign-title"
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-7 text-center border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 ring-4 ring-red-50 dark:ring-red-900/10">
              <Trash2 size={24} />
            </div>
            <h3 id="delete-campaign-title" className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {t.crm.social.modalDeleteTitle}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-2 leading-relaxed">
              {t.crm.social.modalDeleteDesc1}{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {confirmDelete.name}
              </span>
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mb-6 leading-relaxed">
              {t.crm.social.modalDeleteDesc2}
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2.5">
              <button
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.crm.social.cancel}
              </button>
              <button
                disabled={deleting}
                onClick={confirmDeleteCampaign}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>{t.crm.social.deleting}</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>{t.crm.social.delete}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── POST DETAIL MODAL ────────────────────────────────────────────── */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedPost(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    <Sparkles size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">
                      {selectedPost.campaign?.name || "Campaña eliminada"}
                    </h3>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {selectedPost.platforms.map((p: string) => p === "FACEBOOK" ?
                        <span key={p} className="badge bg-blue-50 text-blue-600 dark:bg-blue-900/30 text-[10px]"><Facebook size={10} className="mr-1 inline" />Facebook</span> :
                        <span key={p} className="badge bg-pink-50 text-pink-600 dark:bg-pink-900/30 text-[10px]"><Instagram size={10} className="mr-1 inline" />Instagram</span>
                      )}
                      <span className="badge bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px]">
                        {FREQ_LABELS[selectedPost.frequency] || selectedPost.frequency}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors flex-shrink-0"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">

              {/* AI Content */}
              <div className="flex gap-3 text-sm items-start">
                <FileText size={18} className="flex-shrink-0 mt-0.5" style={{ color: "var(--color-primary)" }} />
                <div className="text-gray-700 dark:text-gray-200 leading-relaxed flex-1">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="underline hover:opacity-80" style={{ color: "var(--color-primary)" }}>{children}</a>,
                      blockquote: ({ children }) => <blockquote className="border-l-2 border-gray-300 pl-3 italic text-gray-500 dark:text-gray-400 my-2">{children}</blockquote>,
                      hr: () => <hr className="my-3 border-gray-200 dark:border-gray-700" />,
                    }}
                  >
                    {selectedPost.content || "Contenido no disponible"}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Date */}
              <div className="flex gap-3 text-sm items-start">
                <Clock size={18} className="flex-shrink-0 mt-0.5" style={{ color: "var(--color-primary)" }} />
                <p className="text-gray-700 dark:text-gray-200">
                  {new Date(selectedPost.postedAt).toLocaleString("es-MX", {
                    weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                  })}
                </p>
              </div>

              {/* Post links */}
              {(selectedPost.postUrls?.facebook?.postUrl || selectedPost.postUrls?.instagram?.postUrl) && (
                <div className="flex gap-3 text-sm items-start">
                  <ExternalLink size={18} className="flex-shrink-0 mt-0.5" style={{ color: "var(--color-primary)" }} />
                  <div className="flex flex-wrap gap-2">
                    {selectedPost.postUrls?.facebook?.postUrl && (
                      <a href={selectedPost.postUrls.facebook.postUrl} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline">
                        <Facebook size={13} /> Ver en Facebook
                      </a>
                    )}
                    {selectedPost.postUrls?.instagram?.postUrl && (
                      <a href={selectedPost.postUrls.instagram.postUrl} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs font-medium text-pink-600 hover:underline">
                        <Instagram size={13} /> Ver en Instagram
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setSelectedPost(null)}
                className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-medium text-white transition"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification toast */}
      {notif && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium text-white animate-in slide-in-from-bottom-3 duration-300 ${notif.ok ? "bg-green-600" : "bg-red-600"}`}>
          {notif.ok ? <Check size={16} /> : <X size={16} />}
          {notif.msg}
          <button onClick={() => setNotif(null)} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
