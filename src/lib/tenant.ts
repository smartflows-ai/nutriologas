// src/lib/tenant.ts
// Utility to reliably extract the tenant slug from the request host header.
// Middleware-set headers can be unreliable in Next.js 14 App Router.
// Instead, we parse the host directly — it is always available.

import { headers } from "next/headers";

export function getTenantSlug(): string {
  const host = headers().get("host") || "";
  
  // Local dev: nutri.localhost:3000 → "nutri"
  if (host.includes(".localhost")) {
    return host.split(".")[0];
  }

  // Production subdomain: nutri.miapp.com → "nutri"
  // Exclude root domains (www, bare hostname, etc.)
  const parts = host.split(".");
  if (parts.length >= 3 && parts[0] !== "www") {
    return parts[0];
  }

  // Custom domain (not a subdomain): return host as-is for DB lookup
  // e.g. clinicanutricion.com → "clinicanutricion.com"
  if (!host.includes("localhost")) {
    return host.split(":")[0]; // strip port if any
  }

  // Fallback for bare localhost:3000
  return "doctor";
}
