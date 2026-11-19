"use client";
// src/components/admin/appointments/AppointmentFormPanel.tsx
// "Nueva cita" and "Editar cita" in /admin/citas (ticket #103), for the owner and staff. Staff only picks free times
// inside business hours; the owner may also type another time and confirm. The phone of an existing visit is shown
// but never editable. Every rule is checked again by the server.
import { AlertCircle, CalendarPlus, Pencil } from "lucide-react";
import FormPanel from "@/components/admin/FormPanel";
import RadioOption from "@/components/ui/RadioOption";
import { useTranslation } from "@/i18n";
import { clinicDateKeyOf } from "@/lib/clinic-time";
import { PHONE_COUNTRIES } from "@/lib/phone";
import { fill } from "@/lib/utils";
import { AlternativesPicker, SlotGrid } from "./SlotGrid";
import { useAppointmentForm, type FormTarget } from "./useAppointmentForm";
import { useBusinessTimeZone } from "@/components/shared/BusinessTimeZone";

const LABEL = "block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1";
const INPUT = "input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-sm";
const HINT = "text-xs text-gray-500 dark:text-gray-400 mt-1";
const SECTION = "text-sm font-semibold text-gray-900 dark:text-white";

interface Props {
  target: FormTarget;
  canOverbook: boolean;
  locale: string;
  onClose: () => void;
  onSaved: (kind: "created" | "updated", calendarSynced: boolean) => void;
}

function PhoneInput({
  id,
  dial,
  value,
  onDial,
  onChange,
  label,
}: {
  id: string;
  dial: string;
  value: string;
  onDial: (v: string) => void;
  onChange: (v: string) => void;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <label htmlFor={id} className={LABEL}>{label}</label>
      <div className="flex gap-2">
        <select value={dial} onChange={(e) => onDial(e.target.value)} aria-label={t.booking.countryCode} className={`${INPUT} w-28 shrink-0 px-2`}>
          {PHONE_COUNTRIES.map((c) => (
            <option key={c.iso} value={c.dial}>
              {c.iso} +{c.dial}
            </option>
          ))}
        </select>
        <input id={id} type="tel" value={value} onChange={(e) => onChange(e.target.value)} placeholder={t.booking.phonePlaceholder} className={`${INPUT} min-w-0`} />
      </div>
    </div>
  );
}

export default function AppointmentFormPanel({ target, canOverbook, locale, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const f = useAppointmentForm({ target, canOverbook, onSaved });
  const { fields: v, set } = f;
  const isEdit = target.mode === "edit";
  const zone = useBusinessTimeZone();
  const today = clinicDateKeyOf(new Date(), zone);
  const modeLabel = (m: "IN_PERSON" | "ONLINE") => (m === "ONLINE" ? t.agenda.modalityOnline : t.agenda.modalityInPerson);

  return (
    <FormPanel
      // Neutral in dark mode: a dark tenant color would disappear on the dark panel.
      icon={isEdit ? <Pencil size={18} className="text-primary dark:text-gray-200" /> : <CalendarPlus size={18} className="text-primary dark:text-gray-200" />}
      title={isEdit ? t.agenda.form.editTitle : t.agenda.form.createTitle}
      onClose={onClose}
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void f.submit();
        }}
      >
        {/* Service, day and time */}
        <section className="space-y-4">
          <div>
            <label htmlFor="appt-service" className={LABEL}>{t.agenda.form.service}</label>
            {f.services && f.services.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">{t.agenda.form.noServices}</p>
            ) : (
              <select id="appt-service" value={v.productId} onChange={(e) => set.productId(e.target.value)} className={INPUT} required>
                <option value="" disabled>{t.agenda.form.servicePlaceholder}</option>
                {(f.services ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {fill(t.productUi.minutesShort, { minutes: s.durationMinutes })}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="appt-day" className={LABEL}>{t.agenda.form.day}</label>
              <input id="appt-day" type="date" min={today} value={v.day} onChange={(e) => set.day(e.target.value)} className={INPUT} required />
            </div>
            {v.manualTime && (
              <div>
                <label htmlFor="appt-time" className={LABEL}>{t.agenda.form.time}</label>
                <input id="appt-time" type="time" step={300} value={v.time} onChange={(e) => set.time(e.target.value)} className={INPUT} required />
              </div>
            )}
          </div>

          {!v.manualTime &&
            (v.productId && v.day ? (
              <SlotGrid slots={f.slots} selected={v.time} onSelect={set.time} loading={f.loadingSlots} />
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t.agenda.form.chooseService}</p>
            ))}

          {canOverbook && (
            <div>
              <button
                type="button"
                onClick={() => {
                  set.manualTime(!v.manualTime);
                  set.time("");
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {v.manualTime ? t.agenda.form.slotsTime : t.agenda.form.otherTime}
              </button>
              {v.manualTime && <p className={HINT}>{t.agenda.form.otherTimeHint}</p>}
            </div>
          )}

          {f.service &&
            (f.service.modalityMode === "ASK" ? (
              <fieldset>
                <legend className={LABEL}>{t.agenda.form.modality}</legend>
                <div className="flex flex-col sm:flex-row sm:gap-6">
                  {f.service.modalities.map((m) => (
                    <RadioOption key={m} name="appt-modality" value={m} checked={v.modality === m} onChange={() => set.modality(m)} label={modeLabel(m)} />
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className="text-xs text-gray-600 dark:text-gray-300">{fill(t.agenda.form.modalityFixed, { mode: modeLabel(f.service.modalityMode) })}</p>
            ))}
        </section>

        {/* Patient */}
        <section className="space-y-4">
          <h3 className={SECTION}>{t.agenda.form.patient}</h3>

          {!isEdit && (
            <div>
              <label className="flex items-start gap-3 text-sm text-gray-800 dark:text-gray-100 cursor-pointer min-h-11 sm:min-h-0">
                <input type="checkbox" checked={v.forOther} onChange={(e) => set.forOther(e.target.checked)} className="mt-0.5 w-4 h-4 accent-primary shrink-0" />
                <span>{t.agenda.form.forOther}</span>
              </label>
              {v.forOther && (
                <div className="mt-3 space-y-1">
                  <PhoneInput
                    id="appt-requester-phone"
                    dial={v.requesterDial}
                    value={v.requesterPhone}
                    onDial={set.requesterDial}
                    onChange={set.requesterPhone}
                    label={t.agenda.form.requesterPhone}
                  />
                  {f.requesterName && <p className={HINT}>{fill(t.agenda.form.requesterKnown, { name: f.requesterName })}</p>}
                  <p className={HINT}>{t.agenda.form.forOtherHint}</p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isEdit ? (
              <div className="md:col-span-2">
                <p className={LABEL}>{t.agenda.form.phone}</p>
                <p className="text-sm text-gray-900 dark:text-white break-all">{f.visit?.customerPhone || "—"}</p>
                <p className={HINT}>{t.agenda.form.phoneLocked}</p>
              </div>
            ) : (
              <div className="md:col-span-2">
                <PhoneInput id="appt-phone" dial={v.dial} value={v.phone} onDial={set.dial} onChange={set.phone} label={t.agenda.form.phone} />
                {f.knownPatient && <p className={HINT}>{t.agenda.form.knownPatient}</p>}
              </div>
            )}

            <div>
              <label htmlFor="appt-name" className={LABEL}>{t.agenda.form.name}</label>
              <input id="appt-name" type="text" maxLength={120} value={v.name} onChange={(e) => set.name(e.target.value)} placeholder={t.booking.fullNamePlaceholder} className={INPUT} required />
            </div>
            <div>
              <label htmlFor="appt-age" className={LABEL}>{t.agenda.form.age}</label>
              <input id="appt-age" type="number" inputMode="numeric" min={0} max={120} value={v.age} onChange={(e) => set.age(e.target.value)} placeholder={t.booking.agePlaceholder} className={INPUT} required />
            </div>

            {f.usesPets && !isEdit && (
              <>
                <div>
                  <label htmlFor="appt-pet" className={LABEL}>{t.agenda.form.petName}</label>
                  <input id="appt-pet" type="text" maxLength={60} value={v.petName} onChange={(e) => set.petName(e.target.value)} placeholder={t.crm.history.petUi.namePlaceholder} className={INPUT} required />
                </div>
                <div>
                  <label htmlFor="appt-species" className={LABEL}>{t.agenda.form.petSpecies}</label>
                  <select id="appt-species" value={v.petSpecies} onChange={(e) => set.petSpecies(e.target.value)} className={INPUT}>
                    <option value="dog">{t.crm.history.petUi.speciesDog}</option>
                    <option value="cat">{t.crm.history.petUi.speciesCat}</option>
                    <option value="bird">{t.crm.history.petUi.speciesBird}</option>
                    <option value="rabbit">{t.crm.history.petUi.speciesRabbit}</option>
                    <option value="other">{t.crm.history.petUi.speciesOther}</option>
                  </select>
                </div>
              </>
            )}

            <div className="md:col-span-2">
              <label htmlFor="appt-email" className={LABEL}>
                {t.agenda.form.email} <span className="font-normal text-gray-500 dark:text-gray-400">{t.agenda.form.emailOptional}</span>
              </label>
              <input id="appt-email" type="email" value={v.email} onChange={(e) => set.email(e.target.value)} placeholder={t.booking.emailPlaceholder} className={INPUT} />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="appt-reason" className={LABEL}>{t.agenda.form.reason}</label>
              <textarea id="appt-reason" rows={3} maxLength={2000} value={v.notes} onChange={(e) => set.notes(e.target.value)} placeholder={t.agenda.form.reasonPlaceholder} className={`${INPUT} resize-none`} />
            </div>
          </div>

          {!isEdit && (
            <div>
              <label className="flex items-start gap-3 text-sm text-gray-800 dark:text-gray-100 cursor-pointer min-h-11 sm:min-h-0">
                <input
                  type="checkbox"
                  checked={v.alreadyConfirmed}
                  onChange={(e) => set.alreadyConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-primary shrink-0"
                />
                <span>{t.agenda.form.alreadyConfirmed}</span>
              </label>
              <p className={`${HINT} ml-7`}>{t.agenda.form.alreadyConfirmedHint}</p>

              <label className="mt-3 flex items-start gap-3 text-sm text-gray-800 dark:text-gray-100 cursor-pointer min-h-11 sm:min-h-0">
                <input
                  type="checkbox"
                  checked={v.whatsappConsent}
                  onChange={(e) => set.whatsappConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-primary shrink-0"
                />
                <span>{t.agenda.form.whatsappConsent}</span>
              </label>
              <p className={`${HINT} ml-7`}>{t.agenda.form.whatsappConsentHint}</p>
            </div>
          )}
        </section>

        {/* A refused time: the nearest free ones, and for the owner the option to save anyway */}
        {(f.error || f.alternatives) && (
          <div role="alert" className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 space-y-3">
            {f.alternatives && <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.agenda.alternativesTitle}</p>}
            {f.error && (
              <p className="text-sm text-gray-800 dark:text-gray-100 flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span>{f.error}</span>
              </p>
            )}
            {f.alternatives && <AlternativesPicker alternatives={f.alternatives} locale={locale} onPick={f.pickAlternative} disabled={f.busy} />}
            {f.canOverride && (
              <div className="pt-1 space-y-2">
                <p className="text-xs text-gray-600 dark:text-gray-300">{t.agenda.form.overrideMessage}</p>
                <button
                  type="button"
                  disabled={f.busy}
                  onClick={() => void f.submit({ override: true })}
                  className="btn-secondary px-4 py-2 text-xs font-semibold"
                >
                  {t.agenda.form.overrideConfirm}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end pt-2 border-t border-gray-200 dark:border-gray-800">
          <button type="button" onClick={onClose} className="btn-ghost px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300">
            {t.agenda.form.cancel}
          </button>
          <button
            type="submit"
            disabled={f.busy || (f.services?.length ?? 0) === 0}
            className="min-h-11 sm:min-h-0 bg-primary hover:opacity-90 text-[color:var(--on-primary)] px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {f.busy ? t.agenda.form.saving : isEdit ? t.agenda.form.saveChanges : t.agenda.form.save}
          </button>
        </div>
      </form>
    </FormPanel>
  );
}
