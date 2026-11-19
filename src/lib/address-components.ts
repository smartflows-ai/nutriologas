// src/lib/address-components.ts
// City, state and country of a place picked in the address search (ticket #120), read from the address components
// the place details already return. Only for the screen: nothing here is stored. Pure: no I/O.

export interface PlaceParts {
  readonly city: string | null;
  readonly region: string | null;
  /** ISO 3166 alpha-2, e.g. "MX". */
  readonly countryCode: string | null;
}

interface Component {
  readonly longText: string;
  readonly shortText: string;
  readonly types: readonly string[];
}

const NONE: PlaceParts = { city: null, region: null, countryCode: null };

function asComponents(value: unknown): Component[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (c): c is Component =>
      !!c && typeof c === "object" && Array.isArray((c as Component).types) && typeof (c as Component).longText === "string"
  );
}

function textOf(components: Component[], type: string, field: "longText" | "shortText" = "longText"): string | null {
  const found = components.find((c) => c.types.includes(type));
  const text = found && typeof found[field] === "string" ? found[field].trim() : "";
  return text || null;
}

export function placeParts(addressComponents: unknown): PlaceParts {
  const components = asComponents(addressComponents);
  if (components.length === 0) return NONE;
  const city =
    textOf(components, "locality") ?? textOf(components, "administrative_area_level_2") ?? textOf(components, "sublocality");
  const country = textOf(components, "country", "shortText");
  return {
    city,
    region: textOf(components, "administrative_area_level_1"),
    countryCode: country && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null,
  };
}
