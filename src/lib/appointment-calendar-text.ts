// src/lib/appointment-calendar-text.ts
// Title and details of the calendar event that mirrors an appointment. One builder for the web booking and the
// WhatsApp bot, so both write the same lines (including age and modality).
import type { Modality } from "@/lib/patient-intake";

const MODALITY_LABELS: Record<"es" | "en", Record<Modality, string>> = {
  es: { IN_PERSON: "Presencial", ONLINE: "En línea" },
  en: { IN_PERSON: "In person", ONLINE: "Online" },
};

/** Label of a visit's modality, or null when the visit has none (older bookings). */
export function modalityLabel(modality: Modality | null | undefined, language: "es" | "en" = "es"): string | null {
  return modality ? MODALITY_LABELS[language][modality] : null;
}

export interface CalendarTextInput {
  serviceName: string;
  customerName: string | null;
  petName?: string | null;
  /** The patient's reason for the visit, when given. */
  reason: string | null;
  /** First line when there is no reason ("Cita agendada por WhatsApp", "Cita agendada vía web"). */
  fallbackReason: string;
  phone: string | null;
  age: number | null;
  modality: Modality | null;
}

export function buildCalendarText(input: CalendarTextInput): { summary: string; description: string } {
  const pet = input.petName ? ` (${input.petName})` : "";
  const summary = `Cita: ${input.serviceName} - ${input.customerName || "Paciente"}${pet}`;
  const modality = modalityLabel(input.modality, "es");
  const description = [
    input.reason ?? input.fallbackReason,
    input.phone ? `Tel: ${input.phone}` : null,
    input.customerName ? `Paciente: ${input.customerName}` : null,
    input.age !== null ? `Edad: ${input.age} años` : null,
    modality ? `Modalidad: ${modality}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return { summary, description };
}
