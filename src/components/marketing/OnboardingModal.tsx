"use client";
// src/components/marketing/OnboardingModal.tsx
import { useState, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import {
  Building2, Globe, MessageCircle, Mail, Lock, Upload,
  AtSign, CheckCircle2, XCircle, Loader2, ChevronRight, ChevronLeft, X, ChevronDown, Search,
  Gift, Sparkles, Stethoscope, ShoppingBag, PawPrint, Plane } from "lucide-react";
import { useTranslation } from "@/i18n";
import { translateApiError } from "@/i18n/validation";
import AddressSearch from "@/components/shared/AddressSearch";
import type { BusinessLocation } from "@/lib/location";

interface Props {
  onClose: () => void;
  initialPlan?: "STARTER" | "PRO";
  initialBillingInterval?: "monthly" | "annual";
  initialVertical?: string;
}

type Step = 1 | 2 | 3 | 4;

const inputCls = "w-full bg-mk-raised border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-mk-violet focus:ring-2 focus:ring-mk-violet/20 transition-all";
const labelCls = "block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider";

// ── Country + dial-code data ──────────────────────────────────────────────────
const COUNTRIES = [
  { code: "MX", dial: "+52" },
  { code: "US", dial: "+1" },
  { code: "CA", dial: "+1" },
  { code: "AR", dial: "+54" },
  { code: "BR", dial: "+55" },
  { code: "CL", dial: "+56" },
  { code: "CO", dial: "+57" },
  { code: "PE", dial: "+51" },
  { code: "VE", dial: "+58" },
  { code: "EC", dial: "+593" },
  { code: "BO", dial: "+591" },
  { code: "PY", dial: "+595" },
  { code: "UY", dial: "+598" },
  { code: "CR", dial: "+506" },
  { code: "GT", dial: "+502" },
  { code: "HN", dial: "+504" },
  { code: "SV", dial: "+503" },
  { code: "NI", dial: "+505" },
  { code: "PA", dial: "+507" },
  { code: "CU", dial: "+53" },
  { code: "DO", dial: "+1" },
  { code: "PR", dial: "+1" },
  { code: "ES", dial: "+34" },
  { code: "DE", dial: "+49" },
  { code: "FR", dial: "+33" },
  { code: "IT", dial: "+39" },
  { code: "GB", dial: "+44" },
  { code: "PT", dial: "+351" },
  { code: "NL", dial: "+31" },
  { code: "CN", dial: "+86" },
  { code: "JP", dial: "+81" },
  { code: "IN", dial: "+91" },
  { code: "AU", dial: "+61" },
  { code: "ZA", dial: "+27" },
  { code: "NG", dial: "+234" },
  { code: "KE", dial: "+254" },
  { code: "SA", dial: "+966" },
  { code: "AE", dial: "+971" },
  { code: "TR", dial: "+90" },
  { code: "IL", dial: "+972" },
];

const MAJOR_CITIES = [
  "Ciudad de México",
  "Guadalajara",
  "Monterrey",
  "Puebla",
  "Tijuana",
  "Toluca",
  "León",
  "Querétaro",
  "Mérida",
  "San Luis Potosí",
  "Aguascalientes",
  "Cancún",
  "Saltillo",
  "Hermosillo",
  "Mexicali",
  "Culiacán",
  "Chihuahua",
  "Morelia",
];

export default function OnboardingModal({
  onClose,
  initialPlan = "STARTER",
  initialBillingInterval = "monthly",
  initialVertical = "HEALTH",
}: Props) {
  const { t, lang } = useTranslation();
  // Step state
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Step 1 — Business
  const [vertical, setVertical] = useState(initialVertical);
  const [name, setName] = useState("");
  const [businessInfo, setBusinessInfo] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [hasPhysicalLocation, setHasPhysicalLocation] = useState(false);
  const [placeLocation, setPlaceLocation] = useState<BusinessLocation | null>(null);
  const [city, setCity] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  // Location combobox
  const [countryQuery, setCountryQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // México default
  const [countryOpen, setCountryOpen] = useState(false);
  const regionNames = new Intl.DisplayNames([lang === "en" ? "en" : "es"], { type: "region" });
  const regionNamesEn = new Intl.DisplayNames(["en"], { type: "region" });
  const countryName = (c: { code: string }) => regionNames.of(c.code) ?? c.code;
  const countryNameEn = (c: { code: string }) => regionNamesEn.of(c.code) ?? c.code;
  // Phone lada selector
  const [dialCountry, setDialCountry] = useState(COUNTRIES[0]);
  const [dialOpen, setDialOpen] = useState(false);
  const [dialQuery, setDialQuery] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Step 2 — Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");

  // Step 3 — Subdomain
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  const [plan] = useState(initialPlan);
  const [billingInterval] = useState(initialBillingInterval);
  const fileRef = useRef<HTMLInputElement>(null);
  const slugTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Filtered country lists
  const filteredCountries = useMemo(() =>
    COUNTRIES.filter(c =>
      countryName(c).toLowerCase().includes(countryQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(countryQuery.toLowerCase())
    ), [countryQuery]);

  const filteredDials = useMemo(() =>
    COUNTRIES.filter(c =>
      countryName(c).toLowerCase().includes(dialQuery.toLowerCase()) ||
      c.dial.includes(dialQuery)
    ), [dialQuery]);

  const filteredCities = useMemo(() =>
    MAJOR_CITIES.filter(c =>
      c.toLowerCase().includes(cityQuery.toLowerCase())
    ), [cityQuery]);

  // ── Logo upload ────────────────────────────────────────────────
  // The file is sent with the sign-up form, so it goes straight into the new tenant's folder.
  const handleLogoChange = (file: File) => {
    setLogoPreview(URL.createObjectURL(file));
    setLogoFile(file);
  };

  // ── Slug check ─────────────────────────────────────────────────
  const checkSlug = useCallback((value: string) => {
    clearTimeout(slugTimer.current);
    const clean = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(clean);
    if (clean.length < 3) { setSlugStatus("idle"); return; }
    setSlugStatus("checking");
    slugTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/tenants/check-slug?slug=${clean}`);
      const data = await res.json();
      setSlugStatus(data.available ? "available" : "taken");
    }, 500);
  }, []);

  // ── Navigation ─────────────────────────────────────────────────
  const next = () => {
    setError("");
    if (step === 1 && (!name || !businessInfo)) {
      setError(t.onboardingUi.bizRequired); return;
    }
    if (step === 1 && hasPhysicalLocation && !placeLocation) {
      setError(t.locationUi.addressMissing); return;
    }
    if (step === 2) {
      if (!email || !password) { setError(t.onboardingUi.credentialsRequired); return; }
      if (password.length < 8) { setError(t.onboardingUi.passwordShort); return; }
      if (password !== confirmPwd) { setError(t.validation.passwordMismatch); return; }
    }
    if (step === 3 && slugStatus !== "available") {
      setError(t.onboardingUi.subdomainUnavailable); return;
    }
    setStep((s) => (s + 1) as Step);
  };
  const prev = () => { setError(""); setStep((s) => (s - 1) as Step); };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!termsAccepted) {
      setError(t.onboardingUi.termsRequired);
      return;
    }
    setLoading(true); setError("");
    const whatsappFull = phoneNumber ? `${dialCountry.dial}${phoneNumber.replace(/^0+/, "")}` : "";
    try {
      const form = new FormData();
      if (logoFile) form.set("logo", logoFile);
      form.set("payload", JSON.stringify({
          email, password, name, slug, businessInfo,
          whatsappNumber: whatsappFull,
          ownerName: ownerName.trim() || undefined,
          hasPhysicalLocation,
          address: hasPhysicalLocation ? placeLocation?.address : undefined,
          placeId: hasPhysicalLocation ? placeLocation?.placeId ?? undefined : undefined,
          latitude: hasPhysicalLocation ? placeLocation?.latitude ?? undefined : undefined,
          longitude: hasPhysicalLocation ? placeLocation?.longitude ?? undefined : undefined,
          plan,
          billingInterval,
          lang,
          vertical,
          isBookingEnabled: vertical !== "ECOMMERCE",
      }));
      const res = await fetch("/api/tenants/register", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setError(translateApiError(t, data.error) ?? t.onboardingUi.genericError); return; }
      setStep(4);
    } catch (e: any) {
      setError(e.message ?? t.onboardingUi.networkError);
    } finally { setLoading(false); }
  };

  const isLocalhost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const port = typeof window !== "undefined" && window.location.port ? `:${window.location.port}` : "";
  const workspaceUrl = isLocalhost ? `http://${slug}.localhost${port}` : `https://${slug}.newaigent.com`;

  // ── Reusable dropdown ──────────────────────────────────────────
  const selectCls = "flex items-center gap-2 w-full bg-mk-raised border border-white/10 rounded-xl px-4 py-3 text-white text-sm hover:border-mk-violet/40 transition-all cursor-pointer";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) { setCountryOpen(false); setDialOpen(false); } }}
    >
      <div
        className="relative w-full max-w-lg rounded-[2rem] border border-white/10 shadow-[0_0_80px_rgba(124,58,237,0.2)] overflow-hidden max-h-[95vh] flex flex-col"
        style={{ background: "var(--mk-surface)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-8 pt-6 sm:pt-8 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <Image
              src="/newaigent-mascot.png" alt="NewAigent" width={32} height={32}
              style={{ filter: "brightness(0) invert(1) drop-shadow(0 0 8px rgba(124,58,237,0.7))" }}
            />
            <span className="text-white font-black text-lg tracking-tight">
              New<span className="text-mk-violet-light">Aigent</span>
            </span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        {step < 4 && (
          <div className="px-5 sm:px-8 mb-4 sm:mb-6 shrink-0">
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(step / 3) * 100}%`, background: "linear-gradient(90deg, var(--mk-violet), var(--mk-indigo))" }}
              />
            </div>
            <p className="text-gray-600 text-xs mt-2">{t.modals.onboarding.stepOf} {step} / 3</p>
          </div>
        )}

        {/* Scrollable body */}
        <div className="px-5 sm:px-8 pb-6 sm:pb-8 overflow-y-auto flex-1">

          {/* ── STEP 1: Business ──────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-black text-white mb-1">{t.modals.onboarding.step1Title}</h2>
                <p className="text-gray-500 text-sm">{t.modals.onboarding.step1Desc}</p>
              </div>

              {/* Business Name */}
              <div>
                <label className={labelCls}><Building2 size={12} className="inline mr-1" />{t.modals.onboarding.bizName}</label>
                <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder={t.modals.onboarding.phBizName} />
              </div>

              {/* Business Vertical Selector */}
              <div>
                <label className={labelCls}>{t.onboardingUi.bizType}</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: "HEALTH", label: t.onboardingUi.healthLabel, icon: Stethoscope, desc: t.onboardingUi.healthDesc },
                    { id: "ECOMMERCE", label: t.onboardingUi.ecommerceLabel, icon: ShoppingBag, desc: t.onboardingUi.ecommerceDesc },
                    { id: "VETERINARY", label: t.onboardingUi.vetLabel, icon: PawPrint, desc: t.onboardingUi.vetDesc },
                    { id: "TOURISM", label: t.onboardingUi.tourLabel, icon: Plane, desc: t.onboardingUi.tourDesc },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVertical(v.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        vertical === v.id
                          ? "border-mk-violet bg-mk-violet/20 text-white shadow-lg shadow-mk-violet/10 scale-102"
                          : "border-white/10 bg-mk-raised text-gray-400 hover:border-white/20"
                      }`}
                    >
                      <span className="block mb-1"><v.icon size={20} /></span>
                      <span className="text-xs font-bold block text-white">{v.label}</span>
                      <span className="text-[10px] text-gray-500 block truncate">{v.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Business Description */}
              <div>
                <label className={labelCls}>{t.modals.onboarding.bizAbout}</label>
                <textarea
                  className={`${inputCls} h-24 resize-none`}
                  value={businessInfo}
                  onChange={e => setBusinessInfo(e.target.value)}
                  placeholder={t.modals.onboarding.phBizAbout}
                />
              </div>

              {/* Owner name */}
              <div>
                <label className={labelCls}>{t.locationUi.ownerNameLabel}</label>
                <input
                  type="text"
                  className={inputCls}
                  value={ownerName}
                  maxLength={80}
                  onChange={e => setOwnerName(e.target.value)}
                  placeholder={t.locationUi.ownerNamePlaceholder}
                />
              </div>

              {/* Physical location (address picked with Google Maps) */}
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasPhysicalLocation}
                    onChange={e => setHasPhysicalLocation(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-mk-raised"
                  />
                  <span>
                    <span className="block text-sm font-medium text-white">{t.locationUi.physicalLocationLabel}</span>
                    <span className="block text-xs text-gray-500">{t.locationUi.physicalLocationHint}</span>
                  </span>
                </label>
                {hasPhysicalLocation && (
                  <div>
                    <label className={labelCls}>{t.locationUi.addressLabel}</label>
                    <AddressSearch
                      value={placeLocation}
                      onChange={setPlaceLocation}
                      inputClassName={inputCls}
                      panelClassName="border border-white/10 bg-mk-raised"
                      mutedClassName="text-gray-500"
                      textClassName="text-white"
                    />
                  </div>
                )}
              </div>

              {/* City + Country row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* City combobox */}
                <div className="relative">
                  <label className={labelCls}>{t.modals.onboarding.city}</label>
                  <button
                    type="button"
                    className={selectCls}
                    onClick={() => { setCityOpen(o => !o); setCountryOpen(false); setDialOpen(false); setCityQuery(""); }}
                  >
                    <span className={`flex-1 text-left truncate ${!city ? "text-gray-600" : "text-white"}`}>
                      {city || t.modals.onboarding.phCity}
                    </span>
                    <ChevronDown size={14} className={`text-gray-500 transition-transform ${cityOpen ? "rotate-180" : ""}`} />
                  </button>

                  {cityOpen && (
                    <div className="absolute z-50 mt-2 w-full bg-mk-raised border border-white/10 rounded-xl shadow-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                        <Search size={14} className="text-gray-500" />
                        <input
                          autoFocus
                          className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none"
                          placeholder={t.modals.onboarding.useCustomCity.replace(":", "") + "..."}
                          value={cityQuery}
                          onChange={e => setCityQuery(e.target.value)}
                        />
                      </div>
                      <ul className="max-h-44 overflow-y-auto">
                        {filteredCities.map(c => (
                          <li
                            key={c}
                            className={`px-4 py-2.5 cursor-pointer text-sm transition-colors ${city === c
                                ? "bg-mk-violet/20 text-mk-violet-light"
                                : "text-gray-300 hover:bg-white/5"
                              }`}
                            onClick={() => { setCity(c); setCityOpen(false); }}
                          >
                            {c}
                          </li>
                        ))}
                        {filteredCities.length === 0 && cityQuery && (
                          <li 
                            className="px-4 py-3 text-gray-400 text-sm italic cursor-pointer hover:bg-white/5 transition-colors"
                            onClick={() => { setCity(cityQuery); setCityOpen(false); }}
                          >
                            {t.modals.onboarding.useCustomCity} "{cityQuery}"
                          </li>
                        )}
                        {filteredCities.length === 0 && !cityQuery && (
                          <li className="px-4 py-3 text-gray-600 text-sm">{t.onboardingUi.noResults}</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Country combobox */}
                <div className="relative">
                  <label className={labelCls}><Globe size={12} className="inline mr-1" />{t.modals.onboarding.country}</label>
                  <button
                    type="button"
                    className={selectCls}
                    onClick={() => { setCountryOpen(o => !o); setDialOpen(false); }}
                  >
                    <span className="text-xs font-semibold leading-none">{selectedCountry.code}</span>
                    <span className="flex-1 text-left truncate">{countryName(selectedCountry)}</span>
                    <ChevronDown size={14} className={`text-gray-500 transition-transform ${countryOpen ? "rotate-180" : ""}`} />
                  </button>

                  {countryOpen && (
                    <div className="absolute z-50 mt-2 w-full bg-mk-raised border border-white/10 rounded-xl shadow-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                        <Search size={14} className="text-gray-500" />
                        <input
                          autoFocus
                          className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none"
                          placeholder={t.modals.onboarding.phSearchCountry}
                          value={countryQuery}
                          onChange={e => setCountryQuery(e.target.value)}
                        />
                      </div>
                      <ul className="max-h-44 overflow-y-auto">
                        {filteredCountries.map(c => (
                          <li
                            key={c.code}
                            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors ${selectedCountry.code === c.code
                                ? "bg-mk-violet/20 text-mk-violet-light"
                                : "text-gray-300 hover:bg-white/5"
                              }`}
                            onClick={() => { setSelectedCountry(c); setCountryOpen(false); setCountryQuery(""); }}
                          >
                            <span className="text-xs font-semibold leading-none">{c.code}</span>
                            <span>{countryName(c)}</span>
                          </li>
                        ))}
                        {filteredCountries.length === 0 && (
                          <li className="px-4 py-3 text-gray-600 text-sm">{t.onboardingUi.noResults}</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>  {/* end city+country grid */}

              {/* WhatsApp with lada selector */}
              <div>
                <label className={labelCls}><MessageCircle size={12} className="inline mr-1" />{t.modals.onboarding.whatsapp}</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Lada picker */}
                  <div className="relative">
                    <button
                      type="button"
                      className="flex items-center justify-center gap-1.5 w-full sm:w-auto bg-mk-raised border border-white/10 rounded-xl px-4 py-3 text-white text-sm hover:border-mk-violet/40 transition-all cursor-pointer whitespace-nowrap"
                      onClick={() => { setDialOpen(o => !o); setCountryOpen(false); }}
                    >
                      <span className="text-xs font-semibold leading-none">{dialCountry.code}</span>
                      <span className="text-gray-400 font-mono">{dialCountry.dial}</span>
                      <ChevronDown size={13} className={`text-gray-500 transition-transform ${dialOpen ? "rotate-180" : ""}`} />
                    </button>

                    {dialOpen && (
                      <div className="absolute z-50 mt-2 left-0 w-64 bg-mk-raised border border-white/10 rounded-xl shadow-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                          <Search size={14} className="text-gray-500" />
                          <input
                            autoFocus
                            className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none"
                            placeholder={t.modals.onboarding.phSearchDial}
                            value={dialQuery}
                            onChange={e => setDialQuery(e.target.value)}
                          />
                        </div>
                        <ul className="max-h-48 overflow-y-auto">
                          {filteredDials.map(c => (
                            <li
                              key={c.code}
                              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors ${dialCountry.code === c.code
                                  ? "bg-mk-violet/20 text-mk-violet-light"
                                  : "text-gray-300 hover:bg-white/5"
                                }`}
                              onClick={() => { setDialCountry(c); setDialOpen(false); setDialQuery(""); }}
                            >
                              <span className="text-xs font-semibold leading-none">{c.code}</span>
                              <span className="flex-1">{countryName(c)}</span>
                              <span className="text-gray-500 font-mono text-xs">{c.dial}</span>
                            </li>
                          ))}
                          {filteredDials.length === 0 && (
                            <li className="px-4 py-3 text-gray-600 text-sm">{t.onboardingUi.noResults}</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Phone number */}
                  <input
                    className={`${inputCls} flex-1`}
                    type="tel"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value.replace(/[^\d\s\-()]/g, ""))}
                    placeholder={t.modals.onboarding.phPhone}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Account ──────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-black text-white mb-1">{t.modals.onboarding.step2Title}</h2>
                <p className="text-gray-500 text-sm">{t.modals.onboarding.step2Desc}</p>
              </div>
              <div>
                <label className={labelCls}><Mail size={12} className="inline mr-1" />{t.modals.onboarding.email}</label>
                <input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t.modals.onboarding.phEmail} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}><Lock size={12} className="inline mr-1" />{t.modals.onboarding.password}</label>
                  <input className={inputCls} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t.modals.onboarding.phPassword} />
                </div>
                <div>
                  <label className={labelCls}>{t.modals.onboarding.confirmPwd}</label>
                  <input className={inputCls} type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder={t.modals.onboarding.phConfirmPwd} />
                </div>
              </div>
              <div>
                <label className={labelCls}><Upload size={12} className="inline mr-1" />{t.modals.onboarding.logoLabel}</label>
                <div
                  className="border-2 border-dashed border-white/10 rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-mk-violet/40 transition-colors"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleLogoChange(f); }}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt={t.onboardingUi.logoAlt} className="h-16 w-16 object-contain rounded-xl" />
                  ) : (
                    <>
                      <Upload size={28} className="text-gray-600" />
                      <p className="text-gray-500 text-sm text-center whitespace-pre-wrap">
                        {t.modals.onboarding.logoUpload}
                      </p>
                    </>
                  )}
                  <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoChange(f); }} />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Subdomain ────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-black text-white mb-1">{t.modals.onboarding.step3Title}</h2>
                <p className="text-gray-500 text-sm">{t.modals.onboarding.step3Desc}</p>
              </div>
              <div>
                <label className={labelCls}><AtSign size={12} className="inline mr-1" />{t.modals.onboarding.subdomain}</label>
                <div className="flex items-center bg-mk-raised border border-white/10 rounded-xl overflow-hidden focus-within:border-mk-violet focus-within:ring-2 focus-within:ring-mk-violet/20 transition-all">
                  <input
                    className="flex-1 min-w-0 bg-transparent px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none"
                    value={slug}
                    onChange={e => checkSlug(e.target.value)}
                    placeholder={t.modals.onboarding.phSubdomain}
                  />
                  <span className="shrink-0 px-3 text-gray-600 text-xs font-medium border-l border-white/10 bg-mk-card py-3 whitespace-nowrap">
                    .newaigent.com
                  </span>
                </div>
                <div className="mt-2 h-5 flex items-center gap-2">
                  {slugStatus === "checking" && <><Loader2 size={14} className="animate-spin text-gray-500" /><span className="text-gray-500 text-xs">{t.modals.onboarding.checking}</span></>}
                  {slugStatus === "available" && <><CheckCircle2 size={14} className="text-green-400" /><span className="text-green-400 text-xs font-semibold">{slug}.newaigent.com {t.modals.onboarding.available}</span></>}
                  {slugStatus === "taken" && <><XCircle size={14} className="text-red-400" /><span className="text-red-400 text-xs font-semibold">{t.modals.onboarding.taken}</span></>}
                </div>
              </div>
              <div className="bg-white/3 border border-white/5 rounded-xl p-4 text-sm text-gray-500 leading-relaxed">
                {t.modals.onboarding.workspaceAt}<br />
                <span className="text-mk-violet-light font-bold">{slug || t.modals.onboarding.phSubdomain}.newaigent.com</span>
                <div className="flex items-center gap-2 mt-4 pt-2 border-t border-white/5">
                  <Gift size={16} className="text-mk-violet-light shrink-0" />
                  <span className="text-gray-400">{t.modals.onboarding.trialNote}</span>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-start gap-3 bg-mk-raised p-3 rounded-xl border border-white/10 hover:border-mk-violet/40 transition-colors">
                  <input
                    id="onboarding-terms-checkbox"
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-mk-violet focus:ring-mk-violet focus:ring-offset-0 cursor-pointer accent-mk-violet shrink-0"
                    required
                  />
                  <label htmlFor="onboarding-terms-checkbox" className="text-xs text-gray-300 leading-snug cursor-pointer select-none">
                    {t.authUi.consentBefore}{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-mk-violet-light hover:text-mk-violet-light underline font-semibold">
                      {t.footer.terms}
                    </a>{" "}
                    {t.authUi.consentMiddle}{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-mk-violet-light hover:text-mk-violet-light underline font-semibold">
                      {t.footer.privacy}
                    </a>.
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: Success ──────────────────────────────── */}
          {step === 4 && (
            <div className="text-center py-4">
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-tr from-mk-violet to-cyan-500 flex items-center justify-center shadow-[0_0_40px_rgba(124,58,237,0.4)]">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3 tracking-tight">{t.modals.onboarding.step4Title}</h2>
              <p className="text-gray-400 text-base mb-2">
                {t.modals.onboarding.step4Desc.replace('Your workspace is ready.', `Your workspace `)}
                {t.modals.onboarding.step4Desc.includes('Your workspace is ready.') && <span className="text-mk-violet-light font-bold">{slug}.newaigent.com</span>}
                {t.modals.onboarding.step4Desc.includes('Tu espacio de trabajo está listo.') && t.modals.onboarding.step4Desc.replace('Tu espacio de trabajo está listo.', 'Tu espacio de trabajo ')}
                {!t.modals.onboarding.step4Desc.includes('Your workspace is ready.') && <span className="text-mk-violet-light font-bold">{slug}.newaigent.com</span>}
                {!t.modals.onboarding.step4Desc.includes('Your workspace is ready.') && " está listo."}
              </p>
              <p className="text-gray-600 text-sm mb-8">{t.modals.onboarding.loginWith} <span className="text-white">{email}</span></p>
              <a
                href={`${workspaceUrl}/login`}
                className="block w-full py-4 rounded-xl font-black text-white text-base transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg, var(--mk-violet) 0%, var(--mk-indigo) 100%)" }}
              >
                {t.modals.onboarding.goDashboard}
              </a>
              <p className="text-gray-700 text-xs mt-4">{t.modals.onboarding.footerNote}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mt-4">
              <XCircle size={16} className="text-red-400 shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Navigation */}
          {step < 4 && (
            <div className={`flex flex-col-reverse sm:flex-row gap-3 mt-6 ${step > 1 ? "justify-between" : "justify-end"}`}>
              {step > 1 && (
                <button
                  onClick={prev}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 text-sm font-semibold transition-all"
                >
                  <ChevronLeft size={16} /> {t.modals.onboarding.btnBack}
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={next}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:-translate-y-0.5"
                  style={{ background: "linear-gradient(135deg, var(--mk-violet) 0%, var(--mk-indigo) 100%)" }}
                >
                  {t.modals.onboarding.btnContinue} <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading || slugStatus !== "available" || !termsAccepted}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:-translate-y-0.5"
                  style={{ background: "linear-gradient(135deg, var(--mk-violet) 0%, var(--mk-indigo) 100%)" }}
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> {t.modals.onboarding.btnCreating}</> : <>{t.modals.onboarding.btnLaunch}</>}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
