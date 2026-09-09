// src/lib/tenant.ts
// Utility to reliably extract the tenant slug from the request host header.
// Middleware-set headers can be unreliable in Next.js 14 App Router.
// Instead, we parse the host directly — it is always available.

import { headers } from "next/headers";

/**
 * The root domain for this SaaS platform — read from env.
 * Set NEXT_PUBLIC_ROOT_DOMAIN=newaigent.com in your .env / hosting config.
 * Visits to the root domain return "" → NewAigent marketing page.
 * Tenant subdomains are: <slug>.<ROOT_DOMAIN>
 */
const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "newaigent.com").toLowerCase();

const ROOT_DOMAINS = [
  ROOT_DOMAIN,
  `www.${ROOT_DOMAIN}`,
  "localhost:3000",
  "localhost",
];

export function resolveTenantSlug(host: string): string {
  const h = (host || "").toLowerCase().trim();
  if (!h) return "";

  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "newaigent.com").toLowerCase();
  const hostWithoutPort = h.split(":")[0];

  // 1. Localhost / Loopback / Local IP without subdomain
  // e.g. "localhost", "localhost:3000", "localhost:3001", "127.0.0.1", "192.168.x.x"
  if (
    hostWithoutPort === "localhost" ||
    hostWithoutPort === "127.0.0.1" ||
    hostWithoutPort.startsWith("192.168.") ||
    hostWithoutPort.startsWith("10.") ||
    hostWithoutPort.endsWith(".local")
  ) {
    return "";
  }

  // 2. Subdomain on localhost: e.g. "doctor.localhost:3000" or "nutri.localhost"
  if (hostWithoutPort.endsWith(".localhost")) {
    const sub = hostWithoutPort.replace(".localhost", "");
    return sub === "www" ? "" : sub;
  }

  // 3. Exact root domain match (with or without www)
  if (
    hostWithoutPort === rootDomain ||
    hostWithoutPort === `www.${rootDomain}` ||
    hostWithoutPort === "newaigent.com" ||
    hostWithoutPort === "www.newaigent.com"
  ) {
    return "";
  }

  // 4. Subdomain on root domain: e.g. "doctor.newaigent.com"
  if (hostWithoutPort.endsWith(`.${rootDomain}`)) {
    const sub = hostWithoutPort.replace(`.${rootDomain}`, "");
    return sub === "www" ? "" : sub;
  }
  if (hostWithoutPort.endsWith(".newaigent.com")) {
    const sub = hostWithoutPort.replace(".newaigent.com", "");
    return sub === "www" ? "" : sub;
  }

  // 5. Custom domain (e.g. "myclinic.com" or "nutrifit.mx")
  return hostWithoutPort;
}

export function getTenantSlug(): string {
  const rawHost = (headers().get("host") || "").toLowerCase();
  return resolveTenantSlug(rawHost);
}
