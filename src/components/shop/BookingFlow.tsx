"use client";
// src/components/shop/BookingFlow.tsx
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  Clock,
  Check,
  ArrowRight,
  User,
  Mail,
  Phone,
  FileText,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { formatPrice, localeFor, fill } from "@/lib/utils";
import { buildFullPhone, DEFAULT_DIAL_CODE, PHONE_COUNTRIES } from "@/lib/phone";
import { clinicDateTime } from "@/lib/clinic-time";
import { BusinessHours, blocksForDate, markSlots } from "@/lib/business-hours";
import { useTranslation } from "@/i18n";
import { translateApiError } from "@/i18n/validation";
import Link from "next/link";

interface Props {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    images: string[];
    description: string | null;
    durationMinutes: number | null;
    category: string | null;
  };
  tenant: {
    name: string;
    whatsappNumber: string | null;
    logoUrl: string | null;
    // Veterinary and pet-care businesses ask for the pet's name and species.
    usesPets: boolean;
  };
  businessHours: BusinessHours;
}

// Text color that stays readable on the tenant's primary color: near-black or white, whichever contrasts more (WCAG relative luminance).
const LIGHT_TEXT = "#ffffff";
const DARK_TEXT = "#111827";
const LUMINANCE_THRESHOLD = 0.179;

function readableTextOn(rgbChannels: string): string {
  const parts = rgbChannels.trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return LIGHT_TEXT;
  const [r, g, b] = parts.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > LUMINANCE_THRESHOLD ? DARK_TEXT : LIGHT_TEXT;
}

// useLayoutEffect warns during server rendering, so fall back to useEffect there.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function BookingFlow({ product, tenant, businessHours }: Props) {
  const { t, lang } = useTranslation();
  const locale = localeFor(lang);

  // Reads the tenant theme from the DOM so text on primary fills works for any tenant color, light or dark.
  const rootRef = useRef<HTMLDivElement>(null);
  const [onPrimary, setOnPrimary] = useState(LIGHT_TEXT);
  useIsomorphicLayoutEffect(() => {
    if (!rootRef.current) return;
    setOnPrimary(readableTextOn(getComputedStyle(rootRef.current).getPropertyValue("--color-primary-rgb")));
  }, []);
  const rootStyle = { "--on-primary": onPrimary } as React.CSSProperties;

  // Next 21 days, only the days the business is open (its weekly hours).
  const availableDays = (() => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 21; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      // Local calendar date. toISOString() would give the UTC date, which can be a day ahead in the evening.
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (blocksForDate(businessHours, dateStr).length > 0) {
        days.push({
          dateStr,
          dayName: d.toLocaleDateString(locale, { weekday: "short" }),
          dayNum: d.getDate(),
          monthName: d.toLocaleDateString(locale, { month: "short" }),
        });
      }
    }
    return days;
  })();

  const [selectedDate, setSelectedDate] = useState<string>(availableDays[0]?.dateStr || "");
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  // Bumped to reload the slots for the selected date, e.g. after the server rejects a slot that was just taken.
  const [reloadKey, setReloadKey] = useState(0);

  // Step 3: Patient form
  const [name, setName] = useState("");
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [petName, setPetName] = useState("");
  const [petSpecies, setPetSpecies] = useState<string>("dog");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success confirmation
  const [confirmedAppointment, setConfirmedAppointment] = useState<any | null>(null);

  // Load available slots when the date changes
  useEffect(() => {
    if (!selectedDate) return;
    // A slower earlier request must not overwrite the slots of the date picked after it.
    let cancelled = false;
    async function loadAvailability() {
      setLoadingSlots(true);
      setSelectedSlot("");
      try {
        const res = await fetch(`/api/appointments/availability?productId=${product.id}&date=${selectedDate}`);
        const data = await res.json();
        if (!cancelled) setSlots(markSlots(data.allSlots || [], data.availableSlots || []));
      } catch (e) {
        console.error("Error loading availability:", e);
        // Never keep another date's slots on screen after a failure.
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }
    loadAvailability();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, product.id, reloadKey]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedSlot) {
      setError(t.booking.errorSelectDateTime);
      return;
    }
    if (!name || !phone || !email) {
      setError(t.booking.errorRequiredFields);
      return;
    }
    if (tenant.usesPets && !petName.trim()) {
      setError(t.apiErrors.pet_required);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const appointmentDateTime = clinicDateTime(selectedDate, selectedSlot);
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          appointmentDate: appointmentDateTime,
          clientName: name,
          clientPhone: buildFullPhone(dialCode, phone),
          clientEmail: email,
          petName: tenant.usesPets ? petName : undefined,
          petSpecies: tenant.usesPets ? petSpecies : undefined,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // The slot was taken by someone else: refresh the list so it is no longer offered.
        if (data.error === "slot_unavailable") setReloadKey((k) => k + 1);
        throw new Error(translateApiError(t, data.error) || t.booking.errorSchedule);
      }

      setConfirmedAppointment(data);
    } catch (e: any) {
      setError(e.message || t.booking.errorConfirm);
    } finally {
      setSubmitting(false);
    }
  };

  // WhatsApp confirmation link, prefilled with the booking details
  const getWhatsAppBookingLink = () => {
    if (!tenant.whatsappNumber) return "#";
    const cleanPhone = tenant.whatsappNumber.replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(
      fill(t.booking.whatsappMessage, {
        business: tenant.name,
        service: product.name,
        date: selectedDate,
        time: selectedSlot,
        name,
      })
    );
    return `https://wa.me/${cleanPhone}?text=${msg}`;
  };

  // ── Success screen ───────────────────────────────────────────
  if (confirmedAppointment) {
    // The service name is bolded inside the sentence, so split the translated text around {service}
    const [successBefore, successAfter = ""] = t.booking.successDesc.split("{service}");
    return (
      <div ref={rootRef} style={rootStyle} className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="w-20 h-20 bg-primary text-[color:var(--on-primary)] ring-1 ring-inset ring-gray-900/15 dark:ring-white/25 rounded-xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={44} />
        </div>

        <span className="px-3.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-800">
          {t.booking.successBadge}
        </span>

        <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white mt-3">
          {fill(t.booking.successTitle, { name: name.split(" ")[0] })}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
          {successBefore}
          <strong className="text-gray-800 dark:text-gray-200">{product.name}</strong>
          {successAfter}
        </p>

        {/* Appointment summary */}
        <div className="card p-6 my-8 text-left space-y-4 border border-primary/10 dark:border-primary/30 bg-gray-100 dark:bg-gray-800">
          <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-500 font-semibold">{t.booking.summaryService}</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{product.name}</span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-500 font-semibold">{t.booking.summaryDateTime}</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {fill(t.booking.dateTimeValue, { date: selectedDate, time: selectedSlot })}
            </span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-500 font-semibold">{t.booking.summaryDuration}</span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {fill(t.booking.durationValue, { minutes: product.durationMinutes || 30 })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-semibold">{t.booking.summaryPrice}</span>
            <span className="text-base font-semibold text-gray-900 dark:text-white">{formatPrice(product.price, locale)}</span>
          </div>
        </div>

        {/* WhatsApp CTA */}
        {tenant.whatsappNumber && (
          <a
            href={getWhatsAppBookingLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 px-6 rounded-xl bg-primary hover:bg-primary/90 text-[color:var(--on-primary)] ring-1 ring-inset ring-gray-900/15 dark:ring-white/25 font-semibold text-sm flex items-center justify-center gap-2 transition-colors mb-4"
          >
            <MessageCircle size={20} />
            {t.booking.whatsappConfirm}
          </a>
        )}

        <div className="flex items-center justify-center gap-4 text-xs font-semibold text-gray-500 mt-6">
          <Link href="/mis-citas" className="hover:text-gray-900 dark:hover:text-white underline">
            {t.booking.viewMyAppointments}
          </Link>
          <span>•</span>
          <Link href="/" className="hover:text-gray-900 dark:hover:text-white underline">
            {t.booking.backHome}
          </Link>
        </div>
      </div>
    );
  }

  // ── Booking form ─────────────────────────────────────────────
  return (
    <div ref={rootRef} style={rootStyle} className="max-w-4xl mx-auto py-8 px-4">
      {/* Header info */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-gray-100 dark:border-gray-800 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
              <Clock size={13} /> {fill(t.booking.sessionDuration, { minutes: product.durationMinutes || 30 })}
            </span>
            {product.category && (
              <span className="text-xs text-gray-400 font-medium">
                • {product.category}
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
            {product.name}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-xl">
            {product.description || t.booking.defaultDescription}
          </p>
        </div>

        <div className="text-left md:text-right flex-shrink-0 bg-gray-50 dark:bg-gray-900/60 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
          <span className="text-xs text-gray-400 font-semibold block">{t.booking.costLabel}</span>
          <span className="text-2xl font-semibold text-gray-900 dark:text-white">{formatPrice(product.price, locale)}</span>
        </div>
      </div>

      <form onSubmit={handleBookingSubmit} className="space-y-10">
        {/* Step 1: Date */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary text-[color:var(--on-primary)] ring-1 ring-inset ring-gray-900/15 dark:ring-white/25 text-xs flex items-center justify-center font-semibold">1</span>
            {t.booking.step1}
          </h3>

          <div className="flex gap-2 overflow-x-auto pb-3 pt-1 scrollbar-none">
            {availableDays.map((d) => {
              const isSelected = selectedDate === d.dateStr;
              return (
                <button
                  type="button"
                  aria-pressed={isSelected}
                  key={d.dateStr}
                  onClick={() => setSelectedDate(d.dateStr)}
                  className={`flex flex-col items-center justify-center min-w-[70px] py-3.5 px-3 rounded-xl border transition-colors text-center flex-shrink-0 ${
                    isSelected
                      ? "bg-primary text-[color:var(--on-primary)] border-gray-900 ring-1 ring-gray-900 dark:border-white dark:ring-white"
                      : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:border-primary/50"
                  }`}
                >
                  <span className="text-xs font-semibold opacity-80">{d.dayName}</span>
                  <span className="text-xl font-semibold my-0.5">{d.dayNum}</span>
                  <span className="text-xs font-medium opacity-80">{d.monthName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Time */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary text-[color:var(--on-primary)] ring-1 ring-inset ring-gray-900/15 dark:ring-white/25 text-xs flex items-center justify-center font-semibold">2</span>
            {t.booking.step2}
          </h3>

          {loadingSlots ? (
            <div className="flex items-center gap-3 py-6 text-gray-400 text-xs">
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              {t.booking.checkingAvailability}
            </div>
          ) : (
            <>
              {!slots.some((slot) => slot.available) && (
            <div role="status" className="p-6 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-600 dark:text-gray-300 text-xs flex items-center gap-3">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{t.booking.noSlots}</span>
            </div>
              )}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {slots.map(({ time: slot, available }) => {
                const isSelected = selectedSlot === slot;
                return (
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    disabled={!available}
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-3 px-2 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 ${
                      !available
                        ? "bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-600 border-gray-100 dark:border-gray-800 cursor-not-allowed line-through"
                        : isSelected
                        ? "bg-primary text-[color:var(--on-primary)] border-gray-900 ring-1 ring-gray-900 dark:border-white dark:ring-white"
                        : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  >
                    {isSelected ? <Check size={12} /> : <Clock size={12} className="text-gray-400" />}
                    {slot}
                  </button>
                );
              })}
            </div>
            </>
          )}
        </div>

        {/* Step 3: Patient details */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary text-[color:var(--on-primary)] ring-1 ring-inset ring-gray-900/15 dark:ring-white/25 text-xs flex items-center justify-center font-semibold">3</span>
            {t.booking.step3}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1.5">
                <User size={13} className="text-gray-500 dark:text-gray-400" /> {t.booking.fullName}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.booking.fullNamePlaceholder}
                className="input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-sm"
              />
            </div>

            {tenant.usesPets && (
              <>
                <div>
                  <label htmlFor="pet-name" className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                    {t.crm.history.petUi.nameLabel}
                  </label>
                  <input
                    id="pet-name"
                    type="text"
                    required
                    maxLength={60}
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    placeholder={t.crm.history.petUi.namePlaceholder}
                    className="input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="pet-species" className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                    {t.crm.history.petUi.speciesLabel}
                  </label>
                  <select
                    id="pet-species"
                    value={petSpecies}
                    onChange={(e) => setPetSpecies(e.target.value)}
                    className="input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-sm"
                  >
                    <option value="dog">{t.crm.history.petUi.speciesDog}</option>
                    <option value="cat">{t.crm.history.petUi.speciesCat}</option>
                    <option value="bird">{t.crm.history.petUi.speciesBird}</option>
                    <option value="rabbit">{t.crm.history.petUi.speciesRabbit}</option>
                    <option value="other">{t.crm.history.petUi.speciesOther}</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1.5">
                <Phone size={13} className="text-gray-500 dark:text-gray-400" /> {t.booking.phone}
              </label>
              <div className="flex gap-2">
                <select
                  value={dialCode}
                  onChange={(e) => setDialCode(e.target.value)}
                  aria-label={t.booking.countryCode}
                  className="input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-sm w-28 shrink-0 px-2"
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
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.booking.phonePlaceholder}
                  className="input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-sm min-w-0"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1.5">
                <Mail size={13} className="text-gray-500 dark:text-gray-400" /> {t.booking.email}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.booking.emailPlaceholder}
                className="input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1.5">
                <FileText size={13} className="text-gray-500 dark:text-gray-400" /> {t.booking.notes}
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.booking.notesPlaceholder}
                className="input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-sm resize-none"
              />
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-400 dark:border-gray-500 rounded-xl text-gray-900 dark:text-white text-xs font-medium flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Action button */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck size={16} className="text-gray-500 dark:text-gray-400" />
            <span>{t.booking.privacyNote}</span>
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedSlot}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-primary hover:bg-primary/90 text-[color:var(--on-primary)] ring-1 ring-inset ring-gray-900/15 dark:ring-white/25 font-semibold text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {t.booking.submitting}
              </>
            ) : (
              <>
                {t.booking.submit}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
