"use client";
// src/app/admin/negocio/page.tsx
import { useState, useEffect, useRef } from "react";
import {
  Building2,
  Globe,
  Lock,
  ExternalLink,
  Upload,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  Phone,
  Bot,
  Sparkles
} from "lucide-react";
import Image from "next/image";
import { useTranslation } from "@/i18n";

export default function BusinessProfilePage() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tenant state
  const [slug, setSlug] = useState("");
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [businessInfo, setBusinessInfo] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Store initial saved values to display as reference and placeholders
  const [initialData, setInitialData] = useState<{
    name: string;
    whatsappNumber: string;
    businessInfo: string;
    logoUrl: string;
  }>({ name: "", whatsappNumber: "", businessInfo: "", logoUrl: "" });

  useEffect(() => {
    async function loadBusinessData() {
      try {
        setLoading(true);
        const res = await fetch("/api/tenants/business");
        if (!res.ok) throw new Error("Failed to load business profile");
        const data = await res.json();
        const tenantData = data.tenant || data;

        const currentSlug = tenantData.slug || "";
        const currentCustomDomain = tenantData.customDomain || null;
        const currentName = tenantData.name || "";
        const currentWhatsapp = tenantData.whatsappNumber || "";
        const currentInfo = tenantData.businessInfo || "";
        const currentLogo = tenantData.logoUrl || "";

        setSlug(currentSlug);
        setCustomDomain(currentCustomDomain);
        setName(currentName);
        setWhatsappNumber(currentWhatsapp);
        setBusinessInfo(currentInfo);
        setLogoUrl(currentLogo);

        setInitialData({
          name: currentName,
          whatsappNumber: currentWhatsapp,
          businessInfo: currentInfo,
          logoUrl: currentLogo,
        });
      } catch (err) {
        console.error("Error loading business profile:", err);
        setError("Error al cargar la información del negocio");
      } finally {
        setLoading(false);
      }
    }
    loadBusinessData();
  }, []);

  // Compute live storefront link (dev vs prod friendly)
  const storefrontUrl = typeof window !== "undefined"
    ? window.location.hostname.includes("localhost")
      ? `http://${slug}.localhost:3000`
      : `https://${customDomain || `${slug}.newaigent.com`}`
    : `https://${slug}.newaigent.com`;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("El archivo supera el límite de 5MB");
      return;
    }

    try {
      setUploadingLogo(true);
      setError(null);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "logo");

      const res = await fetch("/api/upload/cloudinary", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Error al subir logotipo");
      }

      const data = await res.json();
      setLogoUrl(data.url);
    } catch (err: any) {
      console.error("Logo upload error:", err);
      setError(err.message || "Error al subir la imagen");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t.crm.business.nameLabel);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const res = await fetch("/api/tenants/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          whatsappNumber: whatsappNumber.trim(),
          businessInfo: businessInfo.trim(),
          logoUrl: logoUrl.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t.crm.business.saveError);
      }

      setInitialData({
        name: name.trim(),
        whatsappNumber: whatsappNumber.trim(),
        businessInfo: businessInfo.trim(),
        logoUrl: logoUrl.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error("Error saving business profile:", err);
      setError(err.message || t.crm.business.saveError);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando perfil del negocio...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
          <Building2 className="text-primary" size={26} />
          {t.crm.business.title}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          {t.crm.business.subtitle}
        </p>
      </div>

      {/* Domain Info Card (Read-only) */}
      <div className="mb-8 p-5 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/80 dark:to-gray-800/50 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-primary/10 dark:bg-primary/20 rounded-xl text-primary mt-0.5">
              <Globe size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t.crm.business.domainCardTitle}
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                  <Lock size={11} />
                  {t.crm.business.domainLockedBadge}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t.crm.business.domainCardDesc}
              </p>
              <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono text-gray-800 dark:text-gray-200">
                <span>{slug ? `${slug}.newaigent.com` : "..."}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center self-start sm:self-center">
            <a
              href={storefrontUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
            >
              <span>{t.crm.business.visitSite}</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3 pt-3 border-t border-gray-200/60 dark:border-gray-800 flex items-center gap-1.5">
          <Lock size={12} className="shrink-0" />
          {t.crm.business.domainLockedNote}
        </p>
      </div>

      {/* Main Profile Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Brand Section Card */}
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-gray-800">
            <Sparkles size={20} className="text-primary" />
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white text-base">
                {t.crm.business.brandSection}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t.crm.business.brandSectionDesc}
              </p>
            </div>
          </div>

          {/* Logo Field */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-900 dark:text-white">
              {t.crm.business.logoLabel}
            </label>

            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              {/* Preview Circle / Box */}
              <div className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center overflow-hidden shrink-0 group">
                {logoUrl ? (
                  <div className="relative w-full h-full p-2 flex items-center justify-center">
                    <img
                      src={logoUrl}
                      alt="Logo preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                    <Building2 size={30} className="stroke-[1.5]" />
                    <span className="text-[10px] mt-1 font-medium">Sin logo</span>
                  </div>
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center">
                    <Loader2 size={24} className="animate-spin text-white" />
                  </div>
                )}
              </div>

              {/* Upload actions */}
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload-input"
                  disabled={uploadingLogo}
                />
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <Upload size={14} />
                    {uploadingLogo ? t.crm.business.uploading : t.crm.business.uploadLogo}
                  </button>

                  {logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={uploadingLogo}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <Trash2 size={14} />
                      {t.crm.business.removeLogo}
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                  {t.crm.business.logoHint}
                </p>
              </div>
            </div>
          </div>

          {/* Business Name Field */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-900 dark:text-white">
                {t.crm.business.nameLabel}
              </label>
              {initialData.name && (
                <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">
                  {t.crm.business.currentValue} <span className="font-medium text-gray-700 dark:text-gray-300">{initialData.name}</span>
                </span>
              )}
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={initialData.name || t.crm.business.namePlaceholder}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
            />
          </div>
        </div>

        {/* Contact Section Card */}
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-gray-800">
            <Phone size={20} className="text-primary" />
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white text-base">
                {t.crm.business.contactSection}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t.crm.business.contactSectionDesc}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-900 dark:text-white">
                {t.crm.business.whatsappLabel}
              </label>
              {initialData.whatsappNumber && (
                <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">
                  {t.crm.business.currentValue} <span className="font-medium text-gray-700 dark:text-gray-300">{initialData.whatsappNumber}</span>
                </span>
              )}
            </div>
            <input
              type="text"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder={initialData.whatsappNumber || t.crm.business.whatsappPlaceholder}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {t.crm.business.whatsappHint}
            </p>
          </div>
        </div>

        {/* AI Knowledge & Description Card */}
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-gray-800">
            <Bot size={20} className="text-primary" />
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white text-base">
                {t.crm.business.infoSection}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t.crm.business.infoSectionDesc}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-900 dark:text-white">
                {t.crm.business.infoLabel}
              </label>
              {initialData.businessInfo && (
                <span className="text-xs text-gray-400 dark:text-gray-500 font-normal truncate max-w-[280px]">
                  {t.crm.business.currentValue} <span className="font-medium text-gray-700 dark:text-gray-300">{initialData.businessInfo}</span>
                </span>
              )}
            </div>
            <textarea
              rows={4}
              value={businessInfo}
              onChange={(e) => setBusinessInfo(e.target.value)}
              placeholder={initialData.businessInfo || t.crm.business.infoPlaceholder}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm resize-y"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {t.crm.business.infoHint}
            </p>
          </div>
        </div>

        {/* Feedback alert (Error) */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-center gap-3 text-red-700 dark:text-red-300 text-sm">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-2">
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900">
                <Check size={14} />
                {t.crm.business.savedSuccess}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || uploadingLogo}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 focus:outline-hidden focus:ring-2 focus:ring-primary/30 shadow-md shadow-primary/20 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t.crm.business.savingBtn}</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>{t.crm.business.saveBtn}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
