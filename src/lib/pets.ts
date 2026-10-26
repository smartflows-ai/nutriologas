// src/lib/pets.ts
// Pets of veterinary and pet-care tenants. A pet belongs to its owner's patient key (see patient-key.ts).
// Names are matched without case or extra spaces, so "Max" and " max " are one pet for the same owner.
import type { Prisma } from "@prisma/client";

export const PET_SPECIES = ["dog", "cat", "bird", "rabbit", "other"] as const;
export type PetSpecies = (typeof PET_SPECIES)[number];

export function cleanPetName(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, " ").slice(0, 60) : "";
}

export function petNameKey(name: string): string {
  return cleanPetName(name).toLocaleLowerCase("es-MX");
}

export function cleanSpecies(raw: unknown): PetSpecies | null {
  return typeof raw === "string" && (PET_SPECIES as readonly string[]).includes(raw) ? (raw as PetSpecies) : null;
}

/**
 * Finds the owner's pet with this name, or creates it. Call inside the booking transaction so a pet is only
 * created together with the visit. Returns null when there is no name or no owner key.
 */
export async function findOrCreatePet(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; patientKey: string | null; name: string; species?: string | null },
): Promise<string | null> {
  const name = cleanPetName(input.name);
  if (!name || !input.patientKey) return null;

  const nameKey = petNameKey(name);
  const species = cleanSpecies(input.species);
  const pet = await tx.pet.upsert({
    where: {
      tenantId_patientKey_nameKey: { tenantId: input.tenantId, patientKey: input.patientKey, nameKey },
    },
    create: { tenantId: input.tenantId, patientKey: input.patientKey, name, nameKey, species },
    // Keep the first spelling of the name; a species given with a later visit replaces the stored one.
    update: species ? { species } : {},
    select: { id: true },
  });
  return pet.id;
}
