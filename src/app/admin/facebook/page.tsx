"use client";
// src/app/admin/facebook/page.tsx
// Social Campaign Manager — create/manage AI-driven social media campaigns

import { useState, useEffect, useRef } from "react";
import {
  Facebook, Instagram, Sparkles, Loader2, X, Check, Plus,
  ChevronDown, Zap, Target, MessageSquare, Tag, Calendar,
  Pause, Play, Trash2, Edit3, Clock, Image as ImageIcon,
  Upload, Globe
} from "lucide-react";

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
  referenceImages: string[]; campaignGoal: string;
  tone: string; extraContext: string | null;
  frequency: string; isActive: boolean;
  nextPostAt: string | null; lastPostedAt: string | null;
  createdAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
const GOALS = [
  { id: "promocion",   label: "🎯 Promoción",    desc: "Oferta o precio especial" },
  { id: "informativo", label: "📋 Informativo",  desc: "Presenta el servicio" },
  { id: "urgencia",    label: "⚡ Urgencia",     desc: "Cupos / tiempo limitado" },
  { id: "testimonio",  label: "⭐ Testimonio",   desc: "Basado en resultados" },
  { id: "educativo",   label: "🎓 Educativo",    desc: "Tips de valor" },
];

const TONES = [
  { id: "profesional", label: "Profesional" },
  { id: "cercano",     label: "Cercano" },
  { id: "motivacional", label: "Motivacional" },
  { id: "urgente",     label: "Urgente" },
];

const FREQUENCIES = [
  { id: "DAILY",        label: "Diario",         desc: "1 post por día" },
  { id: "EVERY_3_DAYS", label: "Cada 3 días",    desc: "~10 posts/mes" },
  { id: "WEEKLY",       label: "Semanal",        desc: "4 posts/mes" },
  { id: "BIWEEKLY",     label: "Quincenal",      desc: "2 posts/mes" },
  { id: "MONTHLY",      label: "Mensual",        desc: "1 post/mes" },
];

const FREQ_LABELS: Record<string, string> = {
  DAILY: "Diario", EVERY_3_DAYS: "Cada 3 días",
  WEEKLY: "Semanal", BIWEEKLY: "Quincenal", MONTHLY: "Mensual",
};

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function FacebookPage() {
  const [config,    setConfig]    = useState<FacebookConfig | null>(null);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [view,      setView]      = useState<"list" | "form">("list");
  const [editId,    setEditId]    = useState<string | null>(null);

  // ── Form state ───────────────────────────────────────────────────────────
  const [formName,       setFormName]       = useState("");
  const [formPlatforms,  setFormPlatforms]  = useState<string[]>(["FACEBOOK"]);
  const [formProductIds, setFormProductIds] = useState<string[]>([]);
  const [formImages,     setFormImages]     = useState<string[]>([]);
  const [formGoal,       setFormGoal]       = useState("promocion");
  const [formTone,       setFormTone]       = useState("cercano");
  const [formContext,    setFormContext]     = useState("");
  const [formFrequency,  setFormFrequency]  = useState("WEEKLY");
  const [saving,         setSaving]         = useState(false);

  // Image upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Notification
  const [notif, setNotif] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => { loadAll(); }, []);

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

  // ── Image upload (to Cloudinary via existing upload API) ─────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (res.ok) {
          const data = await res.json();
          const url = data.url ?? data.secure_url;
          if (url) setFormImages(prev => [...prev, url]);
        }
      }
    } catch (e) { console.error(e); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  // ── Save campaign ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formPlatforms.length) return;
    setSaving(true);
    try {
      const body = {
        name: formName || "Campaña",
        platforms: formPlatforms,
        productIds: formProductIds,
        referenceImages: formImages,
        campaignGoal: formGoal,
        tone: formTone,
        extraContext: formContext || undefined,
        frequency: formFrequency,
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
  const deleteCampaign = async (id: string) => {
    if (!confirm("¿Eliminar esta campaña?")) return;
    await fetch(`/api/campaigns/social/${id}`, { method: "DELETE" });
    loadAll();
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (c: SocialCampaign) => {
    setEditId(c.id);
    setFormName(c.name); setFormPlatforms(c.platforms);
    setFormProductIds(c.productIds); setFormImages(c.referenceImages);
    setFormGoal(c.campaignGoal); setFormTone(c.tone);
    setFormContext(c.extraContext ?? ""); setFormFrequency(c.frequency);
    setView("form");
  };

  const resetForm = () => {
    setEditId(null); setFormName(""); setFormPlatforms(["FACEBOOK"]);
    setFormProductIds([]); setFormImages([]); setFormGoal("promocion");
    setFormTone("cercano"); setFormContext(""); setFormFrequency("WEEKLY");
  };

  const togglePlatform = (p: string) =>
    setFormPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const toggleProduct = (id: string) =>
    setFormProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-blue-600" size={36} />
    </div>
  );

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!config) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center mb-6">
        <Facebook className="w-10 h-10 text-blue-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Facebook no conectado</h1>
      <p className="text-gray-500 mb-8 max-w-sm">Conecta tu página desde Apps para crear campañas.</p>
      <a href="/admin/apps" className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
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
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campañas Sociales</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1 ml-12">
            El agente de IA genera y publica automáticamente
          </p>
        </div>
        {view === "list" && (
          <button
            onClick={() => { resetForm(); setView("form"); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus size={16} /> Nueva campaña
          </button>
        )}
      </div>

      {/* ── LIST VIEW ──────────────────────────────────────────────────────── */}
      {view === "list" && (
        <div className="space-y-4">
          {campaigns.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Sparkles size={40} className="mx-auto mb-4 opacity-30" />
              <p className="font-medium">No tienes campañas aún</p>
              <p className="text-sm mt-1">Crea tu primera campaña y el agente hará todo el trabajo</p>
            </div>
          )}
          {campaigns.map((c) => (
            <div key={c.id} className={`bg-white dark:bg-gray-900 rounded-2xl border p-5 shadow-sm transition-all ${c.isActive ? "border-gray-200 dark:border-gray-800" : "border-gray-100 dark:border-gray-900 opacity-60"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{c.name}</h3>
                    {c.isActive ? (
                      <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">Activa</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 dark:bg-gray-800 px-2 py-0.5 rounded-full font-medium">Pausada</span>
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
                      <span className="text-xs text-gray-500">{c.productIds.length} producto{c.productIds.length !== 1 ? "s" : ""}</span></>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> Próximo: {formatDate(c.nextPostAt)}
                    </span>
                    {c.lastPostedAt && (
                      <span>Último: {formatDate(c.lastPostedAt)}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(c)} title="Editar"
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all">
                    <Edit3 size={15} />
                  </button>
                  <button onClick={() => toggleActive(c.id, c.isActive)} title={c.isActive ? "Pausar" : "Activar"}
                    className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all">
                    {c.isActive ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <button onClick={() => deleteCampaign(c.id)} title="Eliminar"
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── FORM VIEW ──────────────────────────────────────────────────────── */}
      {view === "form" && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-6">

          {/* Back */}
          <button onClick={() => { resetForm(); setView("list"); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            ← Volver a campañas
          </button>

          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {editId ? "Editar campaña" : "Nueva campaña"}
          </h2>

          {/* Campaign name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nombre de la campaña</label>
            <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
              placeholder="Temporada de verano"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
              <Globe size={14} /> Plataformas
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => togglePlatform("FACEBOOK")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-all ${formPlatforms.includes("FACEBOOK") ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-gray-700 text-gray-500"}`}>
                <Facebook size={16} /> Facebook
                {formPlatforms.includes("FACEBOOK") && <Check size={14} />}
              </button>
              <button type="button" onClick={() => togglePlatform("INSTAGRAM")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-all ${formPlatforms.includes("INSTAGRAM") ? "border-pink-500 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300" : "border-gray-200 dark:border-gray-700 text-gray-500"}`}>
                <Instagram size={16} /> Instagram
                {formPlatforms.includes("INSTAGRAM") && <Check size={14} />}
              </button>
            </div>
          </div>

          {/* Products multi-select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
              <Tag size={14} /> Productos / Servicios a promocionar
            </label>
            {products.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No hay productos activos. El agente promocionará el negocio en general.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {products.map(p => (
                  <button key={p.id} type="button" onClick={() => toggleProduct(p.id)}
                    className={`flex items-center gap-3 text-left p-3 rounded-xl border-2 transition-all ${formProductIds.includes(p.id) ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}>
                    {p.images?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">{new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(p.price)}</p>
                    </div>
                    {formProductIds.includes(p.id) && <Check size={14} className="text-blue-500 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reference images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
              <ImageIcon size={14} /> Imágenes de referencia para el agente
            </label>
            <p className="text-xs text-gray-400 mb-3">El agente usará estas imágenes como inspiración para generar las imágenes de los posts.</p>

            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-full border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all disabled:opacity-50">
              {uploading ? <Loader2 size={20} className="animate-spin text-blue-500" /> : <Upload size={20} className="text-gray-400" />}
              <span className="text-sm text-gray-500">{uploading ? "Subiendo..." : "Haz clic para subir imágenes"}</span>
            </button>

            {formImages.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {formImages.map((url, i) => (
                  <div key={i} className="relative group aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover rounded-xl" />
                    <button type="button" onClick={() => setFormImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Campaign goal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
              <Target size={14} /> Objetivo
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GOALS.map(g => (
                <button key={g.id} type="button" onClick={() => setFormGoal(g.id)}
                  className={`text-left px-4 py-3 rounded-xl border text-sm transition-all ${formGoal === g.id ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"}`}>
                  <div className="font-medium">{g.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{g.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
              <MessageSquare size={14} /> Tono
            </label>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => (
                <button key={t.id} type="button" onClick={() => setFormTone(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${formTone === t.id ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
              <Calendar size={14} /> Frecuencia de publicación
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FREQUENCIES.map(f => (
                <button key={f.id} type="button" onClick={() => setFormFrequency(f.id)}
                  className={`text-left px-3 py-3 rounded-xl border text-sm transition-all ${formFrequency === f.id ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"}`}>
                  <div className="font-medium">{f.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Extra context */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
              <Sparkles size={14} /> Contexto adicional (opcional)
            </label>
            <input type="text" value={formContext} onChange={e => setFormContext(e.target.value)}
              placeholder="Ej: 20% de descuento en agendar cita en línea"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          {/* WhatMe notice */}
          <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-xl flex items-start gap-2.5">
            <span className="text-lg leading-none mt-0.5">💬</span>
            <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed">
              El agente incluirá automáticamente un enlace de <strong>WhatsApp</strong> con tu número registrado.
            </p>
          </div>

          {/* Save */}
          <button onClick={handleSave} disabled={saving || !formPlatforms.length}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 disabled:opacity-60">
            {saving ? <><Loader2 size={18} className="animate-spin" /> Guardando...</> : <><Zap size={18} /> {editId ? "Guardar cambios" : "Crear campaña"}</>}
          </button>
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
