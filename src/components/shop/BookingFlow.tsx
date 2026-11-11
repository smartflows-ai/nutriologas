"use client";
// src/components/shop/BookingFlow.tsx
import { useState, useEffect, useRef } from "react";
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
  AlertCircle,
  MapPin,
  Video
} from "lucide-react";
import { localeFor, fill } from "@/lib/utils";
import { priceViewFor, type PriceMode } from "@/lib/price-display";
import { buildFullPhone, DEFAULT_DIAL_CODE, PHONE_COUNTRIES } from "@/lib/phone";
import { clinicDateTime } from "@/lib/clinic-time";
import { modalityModeFor, parseAge } from "@/lib/patient-intake";
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
    priceMode?: PriceMode | null;
    images: string[];
    description: string | null;
    durationMinutes: number | null;
    category: string | null;
    // How this service is delivered; null = like the business (tenant.serviceModes).
    visitModes: "IN_PERSON" | "ONLINE" | "BOTH" | null;
  };
  tenant: {
    name: string;
    whatsappNumber: string | null;
    logoUrl: string | null;
    // Veterinary and pet-care businesses ask for the pet's name and species.
    usesPets: boolean;
    // Health businesses ask for explicit consent to process the health details the patient writes.
    handlesHealthData: boolean;
    // How the business sees patients: with "BOTH" the patient chooses in person or online.
    serviceModes: "IN_PERSON" | "ONLINE" | "BOTH";
    // Office address shown for in person visits; null without a physical location.
    address: string | null;
  };
  businessHours: BusinessHours;
}

export default function BookingFlow({ product, tenant, businessHours }: Props) {
  const { t, lang } = useTranslation();
  const locale = localeFor(lang);
  const price = priceViewFor(product, t.price, locale);
  // ASK: the patient chooses. Otherwise the mode is fixed by the service (or the business) and only shown.
  const modalityMode = modalityModeFor(tenant.serviceModes, product.visitModes);

  // Text on primary fills uses the tenant's --on-primary (set with the theme, see src/lib/theme-vars.ts).
  const rootRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);

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
  const [age, setAge] = useState("");
  const [modality, setModality] = useState<"IN_PERSON" | "ONLINE" | "">("");
  const [petName, setPetName] = useState("");
  const [petSpecies, setPetSpecies] = useState<string>("dog");
  const [notes, setNotes] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
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
    // The email is optional: without it no calendar invitation is sent.
    if (!name || !phone) {
      setError(t.booking.errorRequiredFields);
      return;
    }
    if (parseAge(age) === null) {
      setError(t.apiErrors.age_required);
      return;
    }
    if (modalityMode === "ASK" && !modality) {
      setError(t.apiErrors.modality_required);
      return;
    }
    if (tenant.usesPets && !petName.trim()) {
      setError(t.apiErrors.pet_required);
      return;
    }
    if (!privacyAccepted) {
      setError(t.booking.privacyConsentBefore + t.booking.privacyConsentLink);
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
          clientEmail: email.trim() || undefined,
          clientAge: age.trim(),
          modality: modalityMode === "ASK" ? modality : undefined,
          petName: tenant.usesPets ? petName : undefined,
          petSpecies: tenant.usesPets ? petSpecies : undefined,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // The slot was taken by someone else: refresh the list so it is no longer offered.
        if (data.error === "slot_unavailable") {
          setReloadKey((k) => k + 1);
          slotsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
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
      <div ref={rootRef} className="max-w-xl mx-auto py-12 px-4 text-center">
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
          {confirmedAppointment.modality && (
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-xs text-gray-500 font-semibold">{t.booking.summaryModality}</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {confirmedAppointment.modality === "ONLINE" ? t.booking.modalityOnline : t.booking.modalityInPerson}
              </span>
            </div>
          )}
          {confirmedAppointment.modality === "IN_PERSON" && tenant.address && (
            <div className="flex justify-between items-center gap-4 pb-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-xs text-gray-500 font-semibold shrink-0">{t.booking.summaryAddress}</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 text-right break-words">{tenant.address}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-semibold">{t.booking.summaryPrice}</span>
            <span className="text-base font-semibold text-gray-900 dark:text-white text-right">{price.text}</span>
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
    <div ref={rootRef} className="max-w-4xl mx-auto py-8 px-4">
      {/* Header info */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-gray-100 dark:border-gray-800 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
              <Clock size={13} /> {fill(t.booking.sessionDuration, { minutes: product.durationMinutes || 30 })}
            </span>
            {modalityMode !== "ASK" && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                {modalityMode === "ONLINE" ? <Video size={13} /> : <MapPin size={13} />}
                {modalityMode === "ONLINE" ? t.booking.modalityOnline : t.booking.modalityInPerson}
              </span>
            )}
            {product.category && (
              <span className="text-xs text-gray-400 font-medium">
                • {product.category}
              </span>
            )}
          </div>
          {modalityMode === "IN_PERSON" && tenant.address && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 break-words">{tenant.address}</p>
          )}
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
            {product.name}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-xl">
            {product.description || t.booking.defaultDescription}
          </p>
        </div>

        <div className="text-left md:text-right flex-shrink-0 bg-gray-50 dark:bg-gray-900/60 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
          <span className="text-xs text-gray-400 font-semibold block">{t.booking.costLabel}</span>
          <span className={`${price.kind === "onRequest" ? "text-lg" : "text-2xl"} font-semibold text-gray-900 dark:text-white`}>{price.text}</span>
          {price.footnote && <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1 max-w-[16rem]">{price.footnote}</span>}
        </div>
      </div>

      <form onSubmit={handleBookingSubmit} className="space-y-10">
        {/* Step 1: Date */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary text-[color:var(--on-primary)] ring-1 ring-inset ring-gray-900/15 dark:ring-white/25 text-xs flex items-center justify-center font-semibold">1</span>
            {t.booking.step1}
          </h3>

          <div className="flex gap-2 overflow-x-auto pb-3 pt-1 scrollbar-slim">
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
        <div ref={slotsRef}>
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
                <div role="status" className="mb-4 p-6 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-600 dark:text-gray-300 text-xs flex items-center gap-3">
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
              <label htmlFor="patient-name" className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1.5">
                <User size={13} className="text-gray-500 dark:text-gray-400" /> {t.booking.fullName}
              </label>
              <input
                id="patient-name"
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
              <label htmlFor="patient-phone" className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1.5">
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
                  id="patient-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.booking.phonePlaceholder}
                  className="input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-sm min-w-0"
                />
              </div>
            </div>

            <div>
              <label htmlFor="patient-age" className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                {t.booking.age}
              </label>
              <input
                id="patient-age"
                type="number"
                inputMode="numeric"
                required
                min={0}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder={t.booking.agePlaceholder}
                className="input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-sm"
              />
            </div>

            {modalityMode === "ASK" && (
              <div className="md:col-span-2">
                <label htmlFor="visit-modality" className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">{t.booking.modality}</label>
                <select
                  id="visit-modality"
                  value={modality}
                  onChange={(e) => setModality(e.target.value as "IN_PERSON" | "ONLINE" | "")}
                  className={`input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-sm ${modality === "" ? "text-gray-400 dark:text-gray-500" : ""}`}
                >
                  <option value="" disabled>{t.booking.modalityChoose}</option>
                  <option value="IN_PERSON" className="text-gray-900">{t.booking.modalityInPerson}</option>
                  <option value="ONLINE" className="text-gray-900">{t.booking.modalityOnline}</option>
                </select>
              </div>
            )}

            <div className="md:col-span-2">
              <label htmlFor="patient-email" className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1.5">
                <Mail size={13} className="text-gray-500 dark:text-gray-400" /> {t.booking.email}{" "}
                <span className="font-normal text-gray-500 dark:text-gray-400">{t.booking.emailOptional}</span>
              </label>
              <input
                id="patient-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.booking.emailPlaceholder}
                className="input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="patient-notes" className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1.5">
                <FileText size={13} className="text-gray-500 dark:text-gray-400" /> {t.booking.notes}
              </label>
              <textarea
                id="patient-notes"
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

        {/* Privacy notice: shown where the patient's data is captured */}
        <label className="flex items-start gap-3 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={privacyAccepted}
            onChange={(e) => setPrivacyAccepted(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-primary shrink-0"
          />
          <span className="space-y-1">
            <span className="block">
              {t.booking.privacyConsentBefore}
              <Link href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline decoration-primary underline-offset-2">
                {t.booking.privacyConsentLink}
              </Link>
              {fill(t.booking.privacyConsentAfter, { name: tenant.name })}
            </span>
            {tenant.handlesHealthData && <span className="block">{t.booking.privacyConsentHealth}</span>}
          </span>
        </label>

        {/* Action button */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck size={16} className="text-gray-500 dark:text-gray-400" />
            <span>{t.booking.privacyNote}</span>
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedSlot || !privacyAccepted}
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
