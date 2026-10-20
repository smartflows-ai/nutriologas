"use client";
// src/components/admin/TenantMeta.tsx
// Exposes the tenant's business settings to CRM client pages without refetching them.
import { createContext, useContext, type ReactNode } from "react";

export interface TenantMeta {
  vertical: string;
  isBookingEnabled: boolean;
}

const TenantMetaContext = createContext<TenantMeta>({ vertical: "ECOMMERCE", isBookingEnabled: true });

export function TenantMetaProvider({ value, children }: { value: TenantMeta; children: ReactNode }) {
  return <TenantMetaContext.Provider value={value}>{children}</TenantMetaContext.Provider>;
}

export function useTenantMeta() {
  return useContext(TenantMetaContext);
}
