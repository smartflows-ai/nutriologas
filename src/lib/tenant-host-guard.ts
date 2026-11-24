// src/lib/tenant-host-guard.ts
// Ticket #146. In production the session cookie has Domain=.newaigent.com, so ONE session is sent to every
// business subdomain. The host says which business the visitor is looking at; the session says whose account
// it is. They must be the same business, or the screen shows one business under the URL of another.
// Pure module: no I/O (tests in tests/tenant-host-guard.test.ts). The data lookup is in
// src/lib/tenant-host-guard-data.ts and the callers are src/lib/auth.ts and src/lib/session.ts.

export interface SessionBusiness {
  readonly slug: string;
  readonly customDomain: string | null;
}

export type HostCheck =
  // The host is the session's business (its subdomain or its custom domain).
  | { readonly kind: "same" }
  // The host belongs to no business: the marketing root, www and localhost. Nothing to compare, and the
  // Google and Facebook callbacks land on the root domain, so it must stay open.
  | { readonly kind: "neutral" }
  // The host is another business, one that does not exist, or the session's business cannot be found.
  | { readonly kind: "other_business" };

// `hostSlug` is resolveTenantSlug(host): "" for a host with no business, the slug for a subdomain and the
// whole hostname for a custom domain. `business` is the session's business, or null when it cannot be found.
export function checkHostAgainstSession(input: {
  readonly hostSlug: string;
  readonly business: SessionBusiness | null;
}): HostCheck {
  const hostSlug = input.hostSlug.trim().toLowerCase();
  if (!hostSlug) return { kind: "neutral" };
  const { business } = input;
  if (!business) return { kind: "other_business" };
  const ownHosts = [business.slug, business.customDomain].filter((value): value is string => !!value);
  return ownHosts.some((own) => own.trim().toLowerCase() === hostSlug) ? { kind: "same" } : { kind: "other_business" };
}

// The access kind a session gets once the host is considered. Only an account that would otherwise get in
// can be turned away by the host; a locked account keeps its own answer.
export type HostAwareAccess = "active" | "password_change" | "none" | "other_business";

export function accessWithHost(access: string | undefined, host: HostCheck["kind"]): HostAwareAccess {
  if (access !== "active" && access !== "password_change") return "none";
  return host === "other_business" ? "other_business" : access;
}

const LOCAL_SUFFIX = ".localhost";
const PORT_PATTERN = /^\d{1,5}$/;

// Where the session's own business lives, for the host the visitor is on now. It is always the shared-cookie
// subdomain (never the custom domain: the cookie is not sent there, so the visitor would be signed out), and
// it always passes the rule above, so the redirect cannot loop.
export function businessHomeUrl(input: {
  readonly slug: string;
  readonly currentHost: string;
  readonly rootDomain: string;
}): string {
  const host = input.currentHost.trim().toLowerCase();
  const [hostname, port] = host.split(":");
  if (hostname === "localhost" || hostname.endsWith(LOCAL_SUFFIX)) {
    // The port comes from the Host header: keep it only when it is a plain number.
    return `http://${input.slug}${LOCAL_SUFFIX}${port && PORT_PATTERN.test(port) ? `:${port}` : ""}`;
  }
  return `https://${input.slug}.${input.rootDomain}`;
}
