// src/lib/product-form-profiles.ts
// Which product types and extra fields the CRM product form offers, per business vertical.
// Keep the vertical lists in step with src/lib/vertical-profile.ts (the sidebar, storefront and assistant read that file).
export type ProductFormType = "PHYSICAL" | "SERVICE";

export interface ProductFormProfile {
  types: ProductFormType[];
  defaultType: ProductFormType;
  showCapacity: boolean;
}

export function getProductFormProfile(vertical: string, isBookingEnabled: boolean): ProductFormProfile {
  switch (vertical) {
    // Health and services businesses sell appointments first, but can also sell physical products.
    case "HEALTH":
    case "SERVICES":
      return { types: ["SERVICE", "PHYSICAL"], defaultType: "SERVICE", showCapacity: false };
    // Services that can have a group or daily limit (pet care, tours, trips).
    case "VETERINARY":
    case "PET_CARE":
    case "TOURISM":
    case "TRAVEL":
      return { types: ["SERVICE", "PHYSICAL"], defaultType: "SERVICE", showCapacity: true };
    // Stores: services only appear when online booking is enabled.
    default:
      return {
        types: isBookingEnabled ? ["PHYSICAL", "SERVICE"] : ["PHYSICAL"],
        defaultType: "PHYSICAL",
        showCapacity: false,
      };
  }
}
