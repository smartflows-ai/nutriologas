// src/lib/currency.ts
// Currency the WhatsApp bot names for prices, from the country of the business zone (ticket #120). No column: the
// prices are stored as typed by the owner, this only says which money they are in. Unknown country: MXN, as before.
// Pure and client-safe.
import { countryForTimeZone } from "./time-zones";

const CURRENCY_BY_COUNTRY: Readonly<Record<string, string>> = {
  MX: "MXN",
  US: "USD",
  CO: "COP",
  PE: "PEN",
  CL: "CLP",
  AR: "ARS",
  ES: "EUR",
};

export const DEFAULT_CURRENCY = "MXN";

export function currencyForCountry(iso: string | null | undefined): string {
  return (iso && CURRENCY_BY_COUNTRY[iso.toUpperCase()]) || DEFAULT_CURRENCY;
}

export function currencyForTimeZone(zone: string | null | undefined): string {
  return currencyForCountry(countryForTimeZone(zone));
}
