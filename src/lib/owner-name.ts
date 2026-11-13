// src/lib/owner-name.ts
// The owner or person in charge of the business. It is required: the reminder and confirmation texts name them.
export function ownerNameIsFilled(value: string | null | undefined): boolean {
  return (value ?? "").trim().length > 0;
}
