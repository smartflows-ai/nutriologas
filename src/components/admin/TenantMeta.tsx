"use client";
// src/components/admin/TenantMeta.tsx
// Exposes the tenant's business settings to CRM client pages without refetching them.
import { createContext, useContext, type ReactNode } from "react";
import { can, canAccessAdminPath, type Permission } from "@/lib/permissions";

export interface TenantMeta {
  vertical: string;
  isBookingEnabled: boolean;
  // Role of the signed-in user. Empty by default, so a page outside the provider gets no permission.
  role: string;
}

const TenantMetaContext = createContext<TenantMeta>({ vertical: "ECOMMERCE", isBookingEnabled: true, role: "" });

export function TenantMetaProvider({ value, children }: { value: TenantMeta; children: ReactNode }) {
  return <TenantMetaContext.Provider value={value}>{children}</TenantMetaContext.Provider>;
}

export function useTenantMeta() {
  return useContext(TenantMetaContext);
}

// UI only (hides controls). The API route is what enforces the permission.
export function useCan(permission: Permission): boolean {
  return can(useContext(TenantMetaContext).role, permission);
}

// Whether a link to another CRM page should be shown: STAFF never sees links it cannot open (e.g. the App Store).
export function useCanOpen(pathname: string): boolean {
  return canAccessAdminPath(useContext(TenantMetaContext).role, pathname);
}
