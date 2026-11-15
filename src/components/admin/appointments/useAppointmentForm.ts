"use client";
// src/components/admin/appointments/useAppointmentForm.ts
// State and actions of the "Nueva cita" / "Editar cita" form of /admin/citas (ticket #103).
// The server re-checks everything; this hook only fills the form, loads the free times and reports errors.
// One action at a time: a double click never creates two visits.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/i18n";
import { translateApiError } from "@/i18n/validation";
import { markSlots } from "@/lib/business-hours";
import { clinicDateKeyOf, clinicDateTime, clinicTimeOf } from "@/lib/clinic-time";
import { isSyntheticEmail } from "@/lib/patient-intake";
import { patientKeyOf } from "@/lib/patient-key";
import { buildFullPhone, DEFAULT_DIAL_CODE } from "@/lib/phone";
import type { AppointmentItem, FreeSlot, ServiceOption, VisitModality } from "./types";

export type FormTarget = { readonly mode: "create" } | { readonly mode: "edit"; readonly visit: AppointmentItem };

const LOOKUP_DELAY_MS = 500;
const REFUSED_WITH_TIMES = new Set(["slot_unavailable", "outside_business_hours"]);

interface Options {
  readonly target: FormTarget;
  /** Owner only: may save outside business hours or on top of another visit after confirming. */
  readonly canOverbook: boolean;
  /** `calendarSynced: false` when a connected calendar could not be updated (the visit itself was saved). */
  readonly onSaved: (kind: "created" | "updated", calendarSynced: boolean) => void;
}

function useKnownPatient(phone: string, enabled: boolean) {
  const [patient, setPatient] = useState<{ name: string | null; age: number | null; email: string | null } | null>(null);
  useEffect(() => {
    setPatient(null);
    if (!enabled || !patientKeyOf(phone)) return;
    let ignore = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/appointments/known-patient?phone=${encodeURIComponent(phone)}`);
        const data = await res.json();
        if (!ignore && res.ok) setPatient(data.patient ?? null);
      } catch {
        // A failed lookup only means nothing is prefilled.
      }
    }, LOOKUP_DELAY_MS);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [phone, enabled]);
  return patient;
}

export function useAppointmentForm({ target, canOverbook, onSaved }: Options) {
  const { t } = useTranslation();
  const visit = target.mode === "edit" ? target.visit : null;
  const original = useMemo(() => {
    if (!visit) return null;
    const at = new Date(visit.appointmentDate);
    const email = visit.customerEmail && !isSyntheticEmail(visit.customerEmail) ? visit.customerEmail : "";
    return {
      productId: visit.productId ?? "",
      day: clinicDateKeyOf(at),
      time: clinicTimeOf(at),
      name: visit.customerName ?? "",
      age: visit.customerAge != null ? String(visit.customerAge) : "",
      email,
      modality: (visit.modality ?? "") as VisitModality | "",
      notes: visit.notes ?? "",
    };
  }, [visit]);

  const [services, setServices] = useState<ServiceOption[] | null>(null);
  const [usesPets, setUsesPets] = useState(false);
  const [productId, setProductId] = useState(original?.productId ?? "");
  const [day, setDay] = useState(original?.day ?? clinicDateKeyOf(new Date()));
  const [time, setTime] = useState(original?.time ?? "");
  const [manualTime, setManualTime] = useState(false);
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [dial, setDial] = useState(DEFAULT_DIAL_CODE);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState(original?.name ?? "");
  const [age, setAge] = useState(original?.age ?? "");
  const [email, setEmail] = useState(original?.email ?? "");
  const [modality, setModality] = useState<VisitModality | "">(original?.modality ?? "");
  const [notes, setNotes] = useState(original?.notes ?? "");
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false);
  const [petName, setPetName] = useState("");
  const [petSpecies, setPetSpecies] = useState("dog");
  const [forOther, setForOther] = useState(false);
  const [requesterDial, setRequesterDial] = useState(DEFAULT_DIAL_CODE);
  const [requesterPhone, setRequesterPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<FreeSlot[] | null>(null);
  const [canOverride, setCanOverride] = useState(false);

  const fullPhone = buildFullPhone(dial, phone);
  const fullRequester = buildFullPhone(requesterDial, requesterPhone);
  const known = useKnownPatient(fullPhone, target.mode === "create");
  const requester = useKnownPatient(fullRequester, target.mode === "create" && forOther);
  const service = services?.find((s) => s.id === productId) ?? null;

  // Services once.
  useEffect(() => {
    fetch("/api/appointments/services")
      .then((r) => r.json())
      .then((d) => {
        setServices(Array.isArray(d.services) ? d.services : []);
        setUsesPets(Boolean(d.usesPets));
      })
      .catch(() => setServices([]));
  }, []);

  // A known patient fills the empty fields; nothing typed by hand is overwritten.
  useEffect(() => {
    if (!known) return;
    setName((v) => v || known.name || "");
    setAge((v) => v || (known.age != null ? String(known.age) : ""));
    setEmail((v) => v || known.email || "");
  }, [known]);

  // Free times of the chosen day; a visit being edited does not block its own slot.
  useEffect(() => {
    if (!productId || !day) {
      setSlots([]);
      return;
    }
    let ignore = false;
    setLoadingSlots(true);
    const exclude = visit ? `&exclude=${encodeURIComponent(visit.id)}` : "";
    fetch(`/api/appointments/availability?productId=${encodeURIComponent(productId)}&date=${day}${exclude}`)
      .then((r) => r.json())
      .then((d) => {
        if (!ignore) setSlots(markSlots(d.allSlots ?? [], d.availableSlots ?? []));
      })
      .catch(() => !ignore && setSlots([]))
      .finally(() => !ignore && setLoadingSlots(false));
    return () => {
      ignore = true;
    };
  }, [productId, day, visit]);

  const createBody = (at: string, override: boolean) => ({
    productId,
    appointmentDate: at,
    clientName: name,
    clientPhone: fullPhone,
    clientAge: age,
    clientEmail: email,
    modality: service?.modalityMode === "ASK" ? modality : undefined,
    notes,
    alreadyConfirmed,
    override,
    forOtherPerson: forOther,
    requesterPhone: forOther ? fullRequester : undefined,
    petName: usesPets ? petName : undefined,
    petSpecies: usesPets ? petSpecies : undefined,
  });

  // Only what changed, so an edit never touches fields nobody looked at.
  const editBody = (at: string, override: boolean): Record<string, unknown> | null => {
    if (!original || !visit) return null;
    const body: Record<string, unknown> = {};
    if (productId !== original.productId) body.productId = productId;
    if (new Date(at).getTime() !== new Date(visit.appointmentDate).getTime()) body.appointmentDate = at;
    if (name !== original.name) body.clientName = name;
    if (age !== original.age) body.clientAge = age;
    if (email !== original.email) body.clientEmail = email;
    if (modality !== original.modality) body.modality = modality;
    if (notes !== original.notes) body.notes = notes;
    if (Object.keys(body).length === 0) return null;
    return { ...body, override };
  };

  const submit = async (options: { override?: boolean; slot?: FreeSlot } = {}) => {
    if (busy) return;
    const override = options.override ?? false;
    const at = options.slot ? options.slot.iso : clinicDateTime(day, time);
    if (!options.slot && !time) {
      setError(productId && day ? t.agenda.form.chooseTime : t.agenda.form.chooseService);
      return;
    }
    const body = visit ? editBody(at, override) : createBody(at, override);
    if (!body) {
      setError(t.agenda.form.noChanges);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(visit ? `/api/appointments/${visit.id}` : "/api/appointments", {
        method: visit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onSaved(visit ? "updated" : "created", data.calendarSynced !== false);
        return;
      }
      if (REFUSED_WITH_TIMES.has(data.error)) {
        setAlternatives(Array.isArray(data.alternatives) ? data.alternatives : []);
        setCanOverride(canOverbook && !override);
      }
      setError(translateApiError(t, data.error) || t.agenda.toastUpdateError);
    } catch {
      setError(t.agenda.toastUpdateErrorNet);
    } finally {
      setBusy(false);
    }
  };

  const pickAlternative = (slot: FreeSlot) => {
    setDay(slot.date);
    setTime(slot.time);
    setManualTime(false);
    setAlternatives(null);
    setCanOverride(false);
    void submit({ slot });
  };

  const dismissRefusal = () => {
    setAlternatives(null);
    setCanOverride(false);
  };

  return {
    visit,
    services,
    service,
    usesPets,
    fields: { productId, day, time, manualTime, dial, phone, name, age, email, modality, notes, alreadyConfirmed, petName, petSpecies, forOther, requesterDial, requesterPhone },
    set: {
      productId: (v: string) => {
        setProductId(v);
        setTime("");
      },
      day: (v: string) => {
        setDay(v);
        setTime("");
      },
      time: setTime,
      manualTime: setManualTime,
      dial: setDial,
      phone: setPhone,
      name: setName,
      age: setAge,
      email: setEmail,
      modality: setModality,
      notes: setNotes,
      alreadyConfirmed: setAlreadyConfirmed,
      petName: setPetName,
      petSpecies: setPetSpecies,
      forOther: setForOther,
      requesterDial: setRequesterDial,
      requesterPhone: setRequesterPhone,
    },
    slots,
    loadingSlots,
    knownPatient: known,
    requesterName: requester?.name ?? null,
    busy,
    error,
    alternatives,
    canOverride,
    submit,
    pickAlternative,
    dismissRefusal,
  };
}
