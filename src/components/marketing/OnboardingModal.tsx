"use client";
// src/components/marketing/OnboardingModal.tsx
import { useState, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import {
  Building2, Globe, MessageCircle, Mail, Lock, Upload,
  AtSign, CheckCircle2, XCircle, Loader2, ChevronRight, ChevronLeft, X, ChevronDown, Search
} from "lucide-react";

interface Props {
  onClose: () => void;
  initialPlan?: "STARTER" | "PRO";
}

type Step = 1 | 2 | 3 | 4;

const inputCls = "w-full bg-[#12121e] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all";
const labelCls = "block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider";

// ── Country + dial-code data ──────────────────────────────────────────────────
const COUNTRIES = [
  { name: "México",            code: "MX", dial: "+52",  flag: "🇲🇽" },
  { name: "United States",     code: "US", dial: "+1",   flag: "🇺🇸" },
  { name: "Canada",            code: "CA", dial: "+1",   flag: "🇨🇦" },
  { name: "Argentina",         code: "AR", dial: "+54",  flag: "🇦🇷" },
  { name: "Brasil",            code: "BR", dial: "+55",  flag: "🇧🇷" },
  { name: "Chile",             code: "CL", dial: "+56",  flag: "🇨🇱" },
  { name: "Colombia",          code: "CO", dial: "+57",  flag: "🇨🇴" },
  { name: "Perú",              code: "PE", dial: "+51",  flag: "🇵🇪" },
  { name: "Venezuela",         code: "VE", dial: "+58",  flag: "🇻🇪" },
  { name: "Ecuador",           code: "EC", dial: "+593", flag: "🇪🇨" },
  { name: "Bolivia",           code: "BO", dial: "+591", flag: "🇧🇴" },
  { name: "Paraguay",          code: "PY", dial: "+595", flag: "🇵🇾" },
  { name: "Uruguay",           code: "UY", dial: "+598", flag: "🇺🇾" },
  { name: "Costa Rica",        code: "CR", dial: "+506", flag: "🇨🇷" },
  { name: "Guatemala",         code: "GT", dial: "+502", flag: "🇬🇹" },
  { name: "Honduras",          code: "HN", dial: "+504", flag: "🇭🇳" },
  { name: "El Salvador",       code: "SV", dial: "+503", flag: "🇸🇻" },
  { name: "Nicaragua",         code: "NI", dial: "+505", flag: "🇳🇮" },
  { name: "Panamá",            code: "PA", dial: "+507", flag: "🇵🇦" },
  { name: "Cuba",              code: "CU", dial: "+53",  flag: "🇨🇺" },
  { name: "República Dominicana", code: "DO", dial: "+1", flag: "🇩🇴" },
  { name: "Puerto Rico",       code: "PR", dial: "+1",   flag: "🇵🇷" },
  { name: "Spain",             code: "ES", dial: "+34",  flag: "🇪🇸" },
  { name: "Germany",           code: "DE", dial: "+49",  flag: "🇩🇪" },
  { name: "France",            code: "FR", dial: "+33",  flag: "🇫🇷" },
  { name: "Italy",             code: "IT", dial: "+39",  flag: "🇮🇹" },
  { name: "United Kingdom",    code: "GB", dial: "+44",  flag: "🇬🇧" },
  { name: "Portugal",          code: "PT", dial: "+351", flag: "🇵🇹" },
  { name: "Netherlands",       code: "NL", dial: "+31",  flag: "🇳🇱" },
  { name: "China",             code: "CN", dial: "+86",  flag: "🇨🇳" },
  { name: "Japan",             code: "JP", dial: "+81",  flag: "🇯🇵" },
  { name: "India",             code: "IN", dial: "+91",  flag: "🇮🇳" },
  { name: "Australia",         code: "AU", dial: "+61",  flag: "🇦🇺" },
  { name: "South Africa",      code: "ZA", dial: "+27",  flag: "🇿🇦" },
  { name: "Nigeria",           code: "NG", dial: "+234", flag: "🇳🇬" },
  { name: "Kenya",             code: "KE", dial: "+254", flag: "🇰🇪" },
  { name: "Saudi Arabia",      code: "SA", dial: "+966", flag: "🇸🇦" },
  { name: "UAE",               code: "AE", dial: "+971", flag: "🇦🇪" },
  { name: "Turkey",            code: "TR", dial: "+90",  flag: "🇹🇷" },
  { name: "Israel",            code: "IL", dial: "+972", flag: "🇮🇱" },
];

export default function OnboardingModal({ onClose, initialPlan = "STARTER" }: Props) {
  // Step state
  const [step, setStep]       = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // Step 1 — Business
  const [name,         setName]         = useState("");
  const [businessInfo, setBusinessInfo] = useState("");
  const [city,         setCity]         = useState("");
  // Location combobox
  const [countryQuery,   setCountryQuery]   = useState("");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // México default
  const [countryOpen,    setCountryOpen]    = useState(false);
  // Phone lada selector
  const [dialCountry,    setDialCountry]    = useState(COUNTRIES[0]);
  const [dialOpen,       setDialOpen]       = useState(false);
  const [dialQuery,      setDialQuery]      = useState("");
  const [phoneNumber,    setPhoneNumber]    = useState("");

  // Step 2 — Account
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [confirmPwd,  setConfirmPwd]  = useState("");
  const [logoUrl,     setLogoUrl]     = useState("");
  const [logoPreview, setLogoPreview] = useState("");

  // Step 3 — Subdomain
  const [slug,       setSlug]       = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle"|"checking"|"available"|"taken">("idle");

  const [plan] = useState(initialPlan);
  const fileRef  = useRef<HTMLInputElement>(null);
  const slugTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Filtered country lists
  const filteredCountries = useMemo(() =>
    COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(countryQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(countryQuery.toLowerCase())
    ), [countryQuery]);

  const filteredDials = useMemo(() =>
    COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(dialQuery.toLowerCase()) ||
      c.dial.includes(dialQuery)
    ), [dialQuery]);

  // ── Logo upload ────────────────────────────────────────────────
  const handleLogoChange = async (file: File) => {
    setLogoPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.set("file", file);
    const res  = await fetch("/api/upload/public", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) setLogoUrl(data.url);
  };

  // ── Slug check ─────────────────────────────────────────────────
  const checkSlug = useCallback((value: string) => {
    clearTimeout(slugTimer.current);
    const clean = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(clean);
    if (clean.length < 3) { setSlugStatus("idle"); return; }
    setSlugStatus("checking");
    slugTimer.current = setTimeout(async () => {
      const res  = await fetch(`/api/tenants/check-slug?slug=${clean}`);
      const data = await res.json();
      setSlugStatus(data.available ? "available" : "taken");
    }, 500);
  }, []);

  // ── Navigation ─────────────────────────────────────────────────
  const next = () => {
    setError("");
    if (step === 1 && (!name || !businessInfo)) {
      setError("Business name and description are required."); return;
    }
    if (step === 2) {
      if (!email || !password) { setError("Email and password are required."); return; }
      if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
      if (password !== confirmPwd) { setError("Passwords don't match."); return; }
    }
    if (step === 3 && slugStatus !== "available") {
      setError("Please choose an available subdomain."); return;
    }
    setStep((s) => (s + 1) as Step);
  };
  const prev = () => { setError(""); setStep((s) => (s - 1) as Step); };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true); setError("");
    const whatsappFull = phoneNumber ? `${dialCountry.dial}${phoneNumber.replace(/^0+/, "")}` : "";
    try {
      const res = await fetch("/api/tenants/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, password, name, slug, businessInfo,
          whatsappNumber: whatsappFull,
          location: city ? `${city}, ${selectedCountry.name}` : selectedCountry.name,
          logoUrl, plan,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      setStep(4);
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally { setLoading(false); }
  };

  const isLocalhost  = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const port         = typeof window !== "undefined" && window.location.port ? `:${window.location.port}` : "";
  const workspaceUrl = isLocalhost ? `http://${slug}.localhost${port}` : `https://${slug}.newaigent.com`;

  // ── Reusable dropdown ──────────────────────────────────────────
  const selectCls = "flex items-center gap-2 w-full bg-[#12121e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm hover:border-violet-500/40 transition-all cursor-pointer";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) { setCountryOpen(false); setDialOpen(false); onClose(); } }}
    >
      <div
        className="relative w-full max-w-lg rounded-[2rem] border border-white/10 shadow-[0_0_80px_rgba(124,58,237,0.2)] overflow-hidden max-h-[95vh] flex flex-col"
        style={{ background: "#0a0a14" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-8 pt-6 sm:pt-8 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <Image
              src="/newaigent-mascot.png" alt="NeoAigent" width={32} height={32}
              style={{ filter: "brightness(0) invert(1) drop-shadow(0 0 8px rgba(124,58,237,0.7))" }}
            />
            <span className="text-white font-black text-lg tracking-tight">
              Neo<span className="text-violet-400">Aigent</span>
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
                style={{ width: `${(step / 3) * 100}%`, background: "linear-gradient(90deg, #7C3AED, #4F46E5)" }}
              />
            </div>
            <p className="text-gray-600 text-xs mt-2">Step {step} of 3</p>
          </div>
        )}

        {/* Scrollable body */}
        <div className="px-5 sm:px-8 pb-6 sm:pb-8 overflow-y-auto flex-1">

          {/* ── STEP 1: Business ──────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-black text-white mb-1">Your Business</h2>
                <p className="text-gray-500 text-sm">Tell us about your business so we can set everything up.</p>
              </div>

              {/* Business Name */}
              <div>
                <label className={labelCls}><Building2 size={12} className="inline mr-1" />Business Name *</label>
                <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Dr. García Nutrition Clinic" />
              </div>

              {/* Business Description */}
              <div>
                <label className={labelCls}>About your business *</label>
                <textarea
                  className={`${inputCls} h-24 resize-none`}
                  value={businessInfo}
                  onChange={e => setBusinessInfo(e.target.value)}
                  placeholder="We are a nutrition clinic helping people reach their health goals..."
                />
              </div>

              {/* City + Country row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* City */}
                <div>
                  <label className={labelCls}>City</label>
                  <input
                    className={inputCls}
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="Mexico City"
                  />
                </div>

                {/* Country combobox */}
                <div className="relative">
                  <label className={labelCls}><Globe size={12} className="inline mr-1" />Country</label>
                  <button
                    type="button"
                    className={selectCls}
                    onClick={() => { setCountryOpen(o => !o); setDialOpen(false); }}
                  >
                    <span className="text-xl">{selectedCountry.flag}</span>
                    <span className="flex-1 text-left truncate">{selectedCountry.name}</span>
                    <ChevronDown size={14} className={`text-gray-500 transition-transform ${countryOpen ? "rotate-180" : ""}`} />
                  </button>

                  {countryOpen && (
                    <div className="absolute z-50 mt-2 w-full bg-[#12121e] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                        <Search size={14} className="text-gray-500" />
                        <input
                          autoFocus
                          className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none"
                          placeholder="Search country…"
                          value={countryQuery}
                          onChange={e => setCountryQuery(e.target.value)}
                        />
                      </div>
                      <ul className="max-h-44 overflow-y-auto">
                        {filteredCountries.map(c => (
                          <li
                            key={c.code}
                            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                              selectedCountry.code === c.code
                                ? "bg-violet-600/20 text-violet-300"
                                : "text-gray-300 hover:bg-white/5"
                            }`}
                            onClick={() => { setSelectedCountry(c); setCountryOpen(false); setCountryQuery(""); }}
                          >
                            <span className="text-lg">{c.flag}</span>
                            <span>{c.name}</span>
                          </li>
                        ))}
                        {filteredCountries.length === 0 && (
                          <li className="px-4 py-3 text-gray-600 text-sm">No results</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>  {/* end city+country grid */}

              {/* WhatsApp with lada selector */}
              <div>
                <label className={labelCls}><MessageCircle size={12} className="inline mr-1" />WhatsApp Number</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Lada picker */}
                  <div className="relative">
                    <button
                      type="button"
                      className="flex items-center justify-center gap-1.5 w-full sm:w-auto bg-[#12121e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm hover:border-violet-500/40 transition-all cursor-pointer whitespace-nowrap"
                      onClick={() => { setDialOpen(o => !o); setCountryOpen(false); }}
                    >
                      <span className="text-lg">{dialCountry.flag}</span>
                      <span className="text-gray-400 font-mono">{dialCountry.dial}</span>
                      <ChevronDown size={13} className={`text-gray-500 transition-transform ${dialOpen ? "rotate-180" : ""}`} />
                    </button>

                    {dialOpen && (
                      <div className="absolute z-50 mt-2 left-0 w-64 bg-[#12121e] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                          <Search size={14} className="text-gray-500" />
                          <input
                            autoFocus
                            className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none"
                            placeholder="Country or +code…"
                            value={dialQuery}
                            onChange={e => setDialQuery(e.target.value)}
                          />
                        </div>
                        <ul className="max-h-48 overflow-y-auto">
                          {filteredDials.map(c => (
                            <li
                              key={c.code}
                              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                                dialCountry.code === c.code
                                  ? "bg-violet-600/20 text-violet-300"
                                  : "text-gray-300 hover:bg-white/5"
                              }`}
                              onClick={() => { setDialCountry(c); setDialOpen(false); setDialQuery(""); }}
                            >
                              <span className="text-lg">{c.flag}</span>
                              <span className="flex-1">{c.name}</span>
                              <span className="text-gray-500 font-mono text-xs">{c.dial}</span>
                            </li>
                          ))}
                          {filteredDials.length === 0 && (
                            <li className="px-4 py-3 text-gray-600 text-sm">No results</li>
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
                    placeholder="55 1234 5678"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Account ──────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-black text-white mb-1">Your Account</h2>
                <p className="text-gray-500 text-sm">These are your admin login credentials.</p>
              </div>
              <div>
                <label className={labelCls}><Mail size={12} className="inline mr-1" />Email *</label>
                <input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="doctor@yourclinic.com" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}><Lock size={12} className="inline mr-1" />Password *</label>
                  <input className={inputCls} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars" />
                </div>
                <div>
                  <label className={labelCls}>Confirm *</label>
                  <input className={inputCls} type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="Repeat password" />
                </div>
              </div>
              <div>
                <label className={labelCls}><Upload size={12} className="inline mr-1" />Logo (optional)</label>
                <div
                  className="border-2 border-dashed border-white/10 rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-violet-500/40 transition-colors"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleLogoChange(f); }}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="logo" className="h-16 w-16 object-contain rounded-xl" />
                  ) : (
                    <>
                      <Upload size={28} className="text-gray-600" />
                      <p className="text-gray-500 text-sm text-center">
                        Drag & drop or click to upload<br />
                        <span className="text-gray-700 text-xs">PNG, JPG, SVG — max 5MB</span>
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
                <h2 className="text-2xl font-black text-white mb-1">Choose your Subdomain</h2>
                <p className="text-gray-500 text-sm">This will be your business's permanent web address.</p>
              </div>
              <div>
                <label className={labelCls}><AtSign size={12} className="inline mr-1" />Subdomain *</label>
                <div className="flex items-center bg-[#12121e] border border-white/10 rounded-xl overflow-hidden focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 transition-all">
                  <input
                    className="flex-1 min-w-0 bg-transparent px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none"
                    value={slug}
                    onChange={e => checkSlug(e.target.value)}
                    placeholder="yourclinic"
                  />
                  <span className="shrink-0 px-3 text-gray-600 text-xs font-medium border-l border-white/10 bg-[#0d0d1a] py-3 whitespace-nowrap">
                    .newaigent.com
                  </span>
                </div>
                <div className="mt-2 h-5 flex items-center gap-2">
                  {slugStatus === "checking"  && <><Loader2 size={14} className="animate-spin text-gray-500" /><span className="text-gray-500 text-xs">Checking availability…</span></>}
                  {slugStatus === "available" && <><CheckCircle2 size={14} className="text-green-400" /><span className="text-green-400 text-xs font-semibold">{slug}.newaigent.com is available!</span></>}
                  {slugStatus === "taken"     && <><XCircle size={14} className="text-red-400" /><span className="text-red-400 text-xs font-semibold">This subdomain is already taken.</span></>}
                </div>
              </div>
              <div className="bg-white/3 border border-white/5 rounded-xl p-4 text-sm text-gray-500 leading-relaxed">
                Your workspace will be at:<br />
                <span className="text-violet-400 font-bold">{slug || "yourclinic"}.newaigent.com</span>
                <br /><br />
                🎁 <span className="text-gray-400">14-day free trial</span> — no credit card required
              </div>
            </div>
          )}

          {/* ── STEP 4: Success ──────────────────────────────── */}
          {step === 4 && (
            <div className="text-center py-4">
              <div className="text-6xl mb-6">🎉</div>
              <h2 className="text-3xl font-black text-white mb-3 tracking-tight">You're all set!</h2>
              <p className="text-gray-400 text-base mb-2">
                Your workspace <span className="text-violet-400 font-bold">{slug}.newaigent.com</span> is ready.
              </p>
              <p className="text-gray-600 text-sm mb-8">Log in with <span className="text-white">{email}</span></p>
              <a
                href={`${workspaceUrl}/login`}
                className="block w-full py-4 rounded-xl font-black text-white text-base transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
              >
                Go to my dashboard →
              </a>
              <p className="text-gray-700 text-xs mt-4">14-day free trial · No credit card · Cancel anytime</p>
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
                  <ChevronLeft size={16} /> Back
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={next}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:-translate-y-0.5"
                  style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
                >
                  Continue <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading || slugStatus !== "available"}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:-translate-y-0.5"
                  style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : <>Launch my workspace →</>}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
