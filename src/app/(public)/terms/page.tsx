// src/app/(public)/terms/page.tsx
import { Metadata } from "next";
import { getTenantSlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import TermsClient from "./TermsClient";

export async function generateMetadata(): Promise<Metadata> {
  const slug = getTenantSlug();
  const isRootDomain = !slug;

  if (isRootDomain) {
    return {
      title: "Terms of Service | NewAigent",
      description:
        "Terms and conditions governing NewAigent SaaS subscriptions, Newy AI copilot services, and platform integrations.",
    };
  }

  let storeName = "Tienda";
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ slug }, { customDomain: slug }] },
      select: { name: true },
    });
    if (tenant?.name) storeName = tenant.name;
  } catch {}

  return {
    title: `Términos de Servicio | ${storeName}`,
    description: `Términos y condiciones de compra y servicio para clientes de ${storeName}.`,
  };
}

export default async function TermsPage() {
  const slug = getTenantSlug();
  const isRootDomain = !slug;

  let tenantName: string | undefined = undefined;
  let tenantLogoUrl: string | null = null;

  if (slug) {
    try {
      const tenant = await prisma.tenant.findFirst({
        where: { OR: [{ slug }, { customDomain: slug }] },
        select: { name: true, logoUrl: true },
      });
      if (tenant) {
        tenantName = tenant.name;
        tenantLogoUrl = tenant.logoUrl;
      }
    } catch (e) {
      console.error("[terms/page.tsx] error fetching tenant:", e);
    }
  }

  return (
    <TermsClient
      isRootDomain={isRootDomain}
      tenantName={tenantName}
      tenantLogoUrl={tenantLogoUrl}
    />
  );
}
