"use client";
// src/components/shared/BusinessTimeZone.tsx
// The business time zone (Tenant.timeZone, ticket #111) for client screens of the CRM and the storefront.
// The layouts fill it from the database once; screens read it with useBusinessTimeZone() and pass it to
// src/lib/clinic-time.ts, so a time is never shown on the visitor's own clock.
import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_TIME_ZONE } from "@/lib/clinic-time";

const BusinessTimeZoneContext = createContext<string>(DEFAULT_TIME_ZONE);

export function BusinessTimeZoneProvider({ timeZone, children }: { timeZone: string; children: ReactNode }) {
  return <BusinessTimeZoneContext.Provider value={timeZone}>{children}</BusinessTimeZoneContext.Provider>;
}

/** IANA name of the business zone ("America/Cancun"); the default zone outside a provider. */
export function useBusinessTimeZone(): string {
  return useContext(BusinessTimeZoneContext);
}
