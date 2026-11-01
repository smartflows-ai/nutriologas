// src/lib/tenant-url.ts
// Public address of a business and of its pages. Pure: no request or database access.

/** https://<custom domain> or https://<slug>.<root domain>, with an optional path. */
export function tenantPublicUrl(
  tenant: { slug: string; customDomain?: string | null },
  path = "",
  rootDomain: string = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "newaigent.com",
): string {
  const host = tenant.customDomain ? tenant.customDomain : `${tenant.slug}.${rootDomain.toLowerCase()}`;
  const cleanPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `https://${host}${cleanPath}`;
}
