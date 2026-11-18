// src/lib/team-numbers.ts
// Is this WhatsApp contact one of the people of the business (the owner or a staff member)? The bot never answers
// them as if they were customers. Numbers are compared by patient key, so +52 1 55..., 52 55... and 55... match.
import { patientKeyOf } from "@/lib/patient-key";

export function isTeamNumber(contactDigits: string | null | undefined, teamNumbers: readonly (string | null | undefined)[]): boolean {
  const contact = contactDigits ? patientKeyOf(contactDigits) : null;
  if (!contact) return false;
  return teamNumbers.some((number) => {
    const key = number ? patientKeyOf(number) : null;
    return key !== null && key === contact;
  });
}
