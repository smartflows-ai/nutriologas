// src/lib/tenant.ts
// Utility to reliably extract the tenant slug from the request host header.
// Middleware-set headers can be unreliable in Next.js 14 App Router.
// Instead, we parse the host directly — it is always available.

import { headers } from "next/headers";

/**
 * The root domain for this SaaS platform — read from env.
 * Set NEXT_PUBLIC_ROOT_DOMAIN=newaigent.com in your .env / hosting config.
 * Visits to the root domain return "" → NeoAigent marketing page.
 * Tenant subdomains are: <slug>.<ROOT_DOMAIN>
 */
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "newaigent.com").toLowerCase();

const ROOT_DOMAINS = [
  ROOT_DOMAIN,
  `www.${ROOT_DOMAIN}`,
  "localhost:3000",
  "localhost",
];

export function getTenantSlug(): string {
  const host = (headers().get("host") || "").toLowerCase();

  // Local dev: nutri.localhost:3000 → "nutri"
  if (host.endsWith(".localhost:3000") || host.endsWith(".localhost")) {
    return host.split(".")[0];
  }

  // Exact root domain match → no tenant (show marketing page)
  if (ROOT_DOMAINS.includes(host)) {
    return "";
  }

  // Production subdomain: doctor.newaigent.com → "doctor"
  if (host.endsWith(".newaigent.com")) {
    return host.replace(".newaigent.com", "");
  }

  // Custom domain (e.g. myclinic.com) — use full host as tenant identifier
  // Strip port if any
  return host.split(":")[0];
}

/**
 * API-route variant — takes an explicit host string instead of reading headers.
 * Use this in route.ts files where you already have: req.headers.get("host")
 *
 * doctor.newaigent.com → "doctor"
 * doctor.localhost:3000 → "doctor"
 * myclinic.com         → "myclinic.com"  (custom domain, looked up by customDomain field)
 */
export function resolveTenantSlug(host: string): string {
  const h = host.toLowerCase();
  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "newaigent.com").toLowerCase();

  if (h.endsWith(".localhost:3000") || h.endsWith(".localhost")) {
    return h.split(".")[0];
  }
  if (h === rootDomain || h === `www.${rootDomain}` || h.startsWith("localhost")) {
    return "";
  }
  if (h.endsWith(`.${rootDomain}`)) {
    return h.replace(`.${rootDomain}`, "");
  }
  // Custom domain — strip port
  return h.split(":")[0];
}
