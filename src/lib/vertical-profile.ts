// src/lib/vertical-profile.ts
// One source of truth for what each business vertical offers: orders, service-first catalog,
// the name used for the customer group (patients, pets, travelers, customers), the name of the STAFF role,
// pets, and the AI helper's tools.
// Unknown or missing verticals use the ECOMMERCE profile.

export type CustomerSubject = "patient" | "pet" | "traveler" | "customer";
// What a STAFF account is called in the CRM (i18n: t.staffUi.titles). Veterinary uses the generic one for now.
export type StaffTitle = "assistant" | "guide" | "staff";

export interface VerticalProfile {
  hasOrders: boolean;
  serviceFirst: boolean;
  subject: CustomerSubject;
  staffTitle: StaffTitle;
  usesPets: boolean;
  showHistory: boolean;
  isBookingEnabled: boolean;
}

const SERVICE_FIRST_VERTICALS = ["HEALTH", "VETERINARY", "TOURISM", "TRAVEL", "SERVICES", "PET_CARE"];
const PET_VERTICALS = ["VETERINARY", "PET_CARE"];

export function getVerticalProfile(vertical: string | null | undefined, isBookingEnabled: boolean): VerticalProfile {
  const v = vertical ?? "ECOMMERCE";
  const subject: CustomerSubject =
    v === "HEALTH" ? "patient"
    : PET_VERTICALS.includes(v) ? "pet"
    : v === "TOURISM" || v === "TRAVEL" ? "traveler"
    : "customer";
  const staffTitle: StaffTitle =
    v === "HEALTH" ? "assistant"
    : v === "TOURISM" || v === "TRAVEL" ? "guide"
    : "staff";

  return {
    // Stores (ECOMMERCE, GENERAL and unknown values) sell physical orders; service verticals do not.
    hasOrders: !SERVICE_FIRST_VERTICALS.includes(v),
    serviceFirst: SERVICE_FIRST_VERTICALS.includes(v),
    subject,
    staffTitle,
    usesPets: PET_VERTICALS.includes(v),
    showHistory: isBookingEnabled,
    isBookingEnabled,
  };
}
