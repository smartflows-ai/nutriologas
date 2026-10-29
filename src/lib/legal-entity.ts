// src/lib/legal-entity.ts
// Who operates NewAigent, for the privacy notice and the terms of service.
// Fill these in before publishing. While a field is empty, the legal pages leave that sentence out and keep
// the generic wording "NewAigent", so an unfinished value is never shown to the public.
// Do not invent values: use the legal name, address and e-mail that appear on your tax registration.

export interface LegalEntity {
  /** Legal name or full name of the person or company that operates NewAigent. */
  name: string;
  /** Registered address (domicilio). */
  address: string;
  /** E-mail for privacy requests. Empty uses the address already published in the notice. */
  privacyEmail: string;
  /** How long data is kept after an account ends, for example "24 meses". Empty omits the sentence. */
  retention: string;
  /** City and state whose courts have jurisdiction, for example "Monterrey, Nuevo León". Empty keeps the generic wording. */
  jurisdiction: string;
}

export const LEGAL_ENTITY: LegalEntity = {
  name: "",
  address: "",
  privacyEmail: "",
  retention: "",
  jurisdiction: "",
};

/** Fields that are still empty, in the order they should be filled. */
export function pendingLegalFields(entity: LegalEntity = LEGAL_ENTITY): (keyof LegalEntity)[] {
  return (Object.keys(entity) as (keyof LegalEntity)[]).filter((key) => entity[key].trim() === "");
}
