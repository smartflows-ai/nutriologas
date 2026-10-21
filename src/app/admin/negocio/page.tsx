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
  Sparkles,
  Clock,
  Plus,
} from "lucide-react";
import Image from "next/image";
import { useTranslation } from "@/i18n";
import { buildFullPhone, splitFullPhone, DEFAULT_DIAL_CODE, PHONE_COUNTRIES } from "@/lib/phone";
import { translateApiError } from "@/i18n/validation";
import {
  BusinessHours,
  DEFAULT_BUSINESS_HOURS,
  DayHours,
  Weekday,
  parseBusinessHours,
} from "@/lib/business-hours";

// Monday first, as most businesses read a week.
const DAY_ORDER: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DEFAULT_BLOCK: DayHours = { start: "09:00", end: "18:00" };
const MAX_BLOCKS = 4; // keep in sync with MAX_BLOCKS_PER_DAY in src/lib/business-hours.ts

// A block needs both times and a closing time after the opening time.
const isInvalidBlock = (block: DayHours) => !block.start || !block.end || block.start >= block.end;

// Blocks of one day must not share time; compared in time order.
const blocksOverlap = (blocks: DayHours[]) => {
  const sorted = [...blocks].sort((a, b) => (a.start < b.start ? -1 : 1));
  return sorted.some((block, i) => i > 0 && sorted[i - 1].end > block.start);
};

// A new block starts where the last one ends and lasts an hour, so it does not overlap by default.
const nextBlock = (blocks: DayHours[]): DayHours => {
  const last = blocks[blocks.length - 1];
  if (!last) return DEFAULT_BLOCK;
  const [h, m] = last.end.split(":").map(Number);
  const endMinutes = Math.min(h * 60 + m + 60, 23 * 60 + 59);
  const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  return { start: last.end, end };
};

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
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [businessInfo, setBusinessInfo] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [hours, setHours] = useState<BusinessHours>(DEFAULT_BUSINESS_HOURS);

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
        const { dial, local } = splitFullPhone(currentWhatsapp);
        setDialCode(dial);
        setWhatsappNumber(local);
        setBusinessInfo(currentInfo);
        setLogoUrl(currentLogo);
        setHours(parseBusinessHours(data.businessHours));

        setInitialData({
          name: currentName,
          whatsappNumber: currentWhatsapp,
          businessInfo: currentInfo,
          logoUrl: currentLogo,
        });
      } catch (err) {
        console.error("Error loading business profile:", err);
        setError(t.businessUi.loadError);
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
      alert(t.businessUi.fileTooLarge);
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
        throw new Error(errData.error || t.businessUi.logoUploadError);
      }

      const data = await res.json();
      setLogoUrl(data.url);
    } catch (err: any) {
      console.error("Logo upload error:", err);
      setError(err.message || t.businessUi.imageUploadError);
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl("");
  };

  const setBlocks = (weekday: Weekday, blocks: DayHours[]) => {
    setHours((prev) => ({ ...prev, [weekday]: blocks }));
  };

  const updateBlock = (weekday: Weekday, index: number, patch: Partial<DayHours>) => {
    setBlocks(weekday, hours[weekday].map((block, i) => (i === index ? { ...block, ...patch } : block)));
  };

  const removeBlock = (weekday: Weekday, index: number) => {
    setBlocks(weekday, hours[weekday].filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t.crm.business.nameLabel);
      return;
    }

    const fullWhatsapp = buildFullPhone(dialCode, whatsappNumber);
    if (!/^\+\d{8,15}$/.test(fullWhatsapp)) {
      setError(t.crm.business.whatsappRequired);
      return;
    }

    if (DAY_ORDER.some((weekday) => hours[weekday].some(isInvalidBlock))) {
      setError(t.crm.business.hoursInvalidRange);
      return;
    }
    if (DAY_ORDER.some((weekday) => blocksOverlap(hours[weekday]))) {
      setError(t.crm.business.hoursOverlap);
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
          whatsappNumber: fullWhatsapp,
          businessInfo: businessInfo.trim(),
          logoUrl: logoUrl.trim() || null,
          businessHours: hours,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(translateApiError(t, data.error) || t.crm.business.saveError);
      }

      setInitialData({
        name: name.trim(),
        whatsappNumber: fullWhatsapp,
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
        <p className="text-sm text-gray-500 dark:text-gray-400">{t.businessUi.loading}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2.5">
          <Building2 className="text-primary" size={26} />
          {t.crm.business.title}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          {t.crm.business.subtitle}
        </p>
      </div>

      {/* Domain Info Card (Read-only) */}
      <div className="mb-8 p-5 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-primary mt-0.5">
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-primary bg-gray-100 dark:bg-gray-800 hover:bg-primary/20 dark:bg-gray-800 dark:hover:bg-primary/30 transition-colors"
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
        <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
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
              <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center overflow-hidden shrink-0 group">
                {logoUrl ? (
                  <div className="relative w-full h-full p-2 flex items-center justify-center">
                    <img
                      src={logoUrl}
                      alt={t.businessUi.logoPreviewAlt}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                    <Building2 size={30} className="stroke-[1.5]" />
                    <span className="text-xs mt-1 font-medium">{t.businessUi.noLogo}</span>
                  </div>
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
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
        <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
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
            <div className="flex gap-2">
              <select
                value={dialCode}
                onChange={(e) => setDialCode(e.target.value)}
                aria-label={t.crm.business.countryCode}
                className="w-28 shrink-0 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              >
                {PHONE_COUNTRIES.map((c) => (
                  <option key={c.iso} value={c.dial}>
                    {c.iso} +{c.dial}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                required
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder={t.crm.business.whatsappPlaceholder}
                className="min-w-0 w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {t.crm.business.whatsappHint}
            </p>
          </div>
        </div>

        {/* AI Knowledge & Description Card */}
        <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
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

        {/* Business hours: one weekly schedule for the storefront and the WhatsApp bot */}
        <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-gray-800">
            <Clock size={20} className="text-primary" />
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white text-base">
                {t.crm.business.hoursSection}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t.crm.business.hoursSectionDesc}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {DAY_ORDER.map((weekday) => {
              const blocks = hours[weekday];
              const dayName = t.crm.business.hoursDays[weekday];
              const isOpen = blocks.length > 0;
              return (
                <div key={weekday} className="flex flex-wrap items-start gap-3">
                  <label className="flex items-center gap-2 w-36 pt-2 text-sm font-medium text-gray-900 dark:text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isOpen}
                      onChange={() => setBlocks(weekday, isOpen ? [] : [DEFAULT_BLOCK])}
                      className="w-4 h-4 accent-primary rounded cursor-pointer"
                    />
                    {dayName}
                  </label>

                  {isOpen ? (
                    <div className="flex-1 min-w-[16rem] space-y-2">
                      {blocks.map((block, index) => (
                        <div key={index} className="flex flex-wrap items-center gap-2">
                          <input
                            type="time"
                            aria-label={`${dayName}: ${t.crm.business.hoursFrom} ${index + 1}`}
                            value={block.start}
                            onChange={(e) => updateBlock(weekday, index, { start: e.target.value })}
                            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                          <span className="text-xs text-gray-400 dark:text-gray-500">{t.crm.business.hoursTo}</span>
                          <input
                            type="time"
                            aria-label={`${dayName}: ${t.crm.business.hoursTo} ${index + 1}`}
                            value={block.end}
                            onChange={(e) => updateBlock(weekday, index, { end: e.target.value })}
                            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                          {blocks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeBlock(weekday, index)}
                              aria-label={`${dayName}: ${t.crm.business.hoursRemoveBlock} ${index + 1}`}
                              className="p-2 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          {isInvalidBlock(block) && (
                            <span className="text-xs text-red-600 dark:text-red-400">{t.crm.business.hoursInvalidRange}</span>
                          )}
                        </div>
                      ))}
                      {blocks.length < MAX_BLOCKS && (
                        <button
                          type="button"
                          onClick={() => setBlocks(weekday, [...blocks, nextBlock(blocks)])}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
                        >
                          <Plus size={14} />
                          {t.crm.business.hoursAddBlock}
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="pt-2 text-xs text-gray-400 dark:text-gray-500">{t.crm.business.hoursClosed}</span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            {t.crm.business.hoursHint}
          </p>
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
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 focus:outline-hidden focus:ring-2 focus:ring-primary/30 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
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
