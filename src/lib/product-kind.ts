// src/lib/product-kind.ts
// What kind of catalog item the agent is talking about: a bookable service (CITA), a service that is only described
// (INFORMACION), or a physical item that the team sells through WhatsApp (PRODUCTO). Pure, used by bot/context.

export type ProductKind = "CITA" | "INFORMACION" | "PRODUCTO";

export function productKindOf(input: { itemType: string; bookable: boolean }): ProductKind {
  if (input.itemType === "PHYSICAL") return "PRODUCTO";
  return input.bookable ? "CITA" : "INFORMACION";
}
