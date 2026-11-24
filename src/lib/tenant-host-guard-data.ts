// src/lib/tenant-host-guard-data.ts
// Reads the host of the request and the session's business, and applies the rule in tenant-host-guard.ts
// (ticket #146). At most one primary-key read, and none on the root domain or localhost.
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { resolveTenantSlug } from "@/lib/tenant";
import { businessHomeUrl, checkHostAgainstSession, type HostCheck, type SessionBusiness } from "@/lib/tenant-host-guard";

export interface RequestHostCheck {
  readonly kind: HostCheck["kind"];
  // Where the session's own business lives; null when it cannot be computed (the caller then sends to /login).
  readonly homeUrl: string | null;
}

const NO_HOME: string | null = null;

async function readSessionBusiness(tenantId: string): Promise<SessionBusiness | null> {
  try {
    return await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, customDomain: true } });
  } catch (error) {
    // Fail closed: a business that cannot be read counts as a mismatch for that request.
    console.error("[tenant-host-guard] Error:", error instanceof Error ? error.name : "unknown");
    return null;
  }
}

export async function checkRequestHost(tenantId: string): Promise<RequestHostCheck> {
  const host = (headers().get("host") ?? "").toLowerCase();
  const hostSlug = resolveTenantSlug(host);
  if (!hostSlug) return { kind: "neutral", homeUrl: NO_HOME };

  const business = tenantId ? await readSessionBusiness(tenantId) : null;
  const { kind } = checkHostAgainstSession({ hostSlug, business });
  if (kind !== "other_business" || !business) return { kind, homeUrl: NO_HOME };

  const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "newaigent.com").toLowerCase();
  return { kind, homeUrl: businessHomeUrl({ slug: business.slug, currentHost: host, rootDomain }) };
}
