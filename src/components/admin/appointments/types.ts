// src/components/admin/appointments/types.ts
// Shapes the /admin/citas screen receives from /api/appointments and its helpers (ticket #103).
import type { PriceMode } from "@/lib/price-display";

export type VisitStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type VisitModality = "IN_PERSON" | "ONLINE";

/** One delete or restore of a visit: who and when (appointment_trail). */
export interface TrailEntry {
  readonly action: "DELETED" | "RESTORED";
  readonly at: string;
  readonly by: string | null;
}

export interface AppointmentItem {
  id: string;
  source?: "native" | "google" | "microsoft";
  tenantId: string;
  userId?: string;
  productId?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  appointmentDate: string;
  durationMinutes: number;
  notes: string | null;
  internalNotes?: string | null;
  status: VisitStatus;
  createdAt: string;
  htmlLink?: string;
  product?: {
    id: string;
    name: string;
    price: number;
    priceMode?: PriceMode | null;
    durationMinutes: number | null;
    category: string | null;
  };
  customerEmail?: string | null;
  customerAge?: number | null;
  referredByKey?: string | null;
  referredByName?: string | null;
  modality?: VisitModality | null;
  meetUrl?: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  pet?: { name: string } | null;
  reminderSentAt?: string | null;
  reminderAttempts?: number;
  /** WhatsApp permission of the visit's patient (holes 4 and 5). */
  whatsappPermission?: "YES" | "NONE" | "OPTED_OUT";
  /** Only in the "Eliminadas" list. */
  deletedAt?: string | null;
  trail?: TrailEntry[];
}

/** A free time offered when the chosen one is taken (D10). `iso` is ready to send back as appointmentDate. */
export interface FreeSlot {
  readonly date: string;
  readonly time: string;
  readonly iso: string;
}

/** A bookable service for the "Nueva cita" form (no price). */
export interface ServiceOption {
  readonly id: string;
  readonly name: string;
  readonly durationMinutes: number;
  readonly modalityMode: VisitModality | "ASK";
  readonly modalities: readonly VisitModality[];
}
