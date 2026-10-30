// src/app/(public)/privacy/page.tsx
import { Metadata } from "next";
import { getTenantSlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import PrivacyClient from "./PrivacyClient";
import type { LegalSubject } from "@/components/legal/legalContent";

export async function generateMetadata(): Promise<Metadata> {
  const slug = getTenantSlug();
  const isRootDomain = !slug;

  if (isRootDomain) {
    return {
      title: "Privacy Policy | NewAigent",
      description:
        "Learn about NewAigent's enterprise data protection, multi-tenant isolation, and zero-leak AI copilot security standards.",
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
    title: `Política de Privacidad | ${storeName}`,
    description: `Aviso de privacidad y protección de datos para clientes de ${storeName}.`,
  };
}

export default async function PrivacyPage() {
  const slug = getTenantSlug();
  const isRootDomain = !slug;

  let tenantName: string | undefined = undefined;
  let tenantLogoUrl: string | null = null;
  let subject: LegalSubject | undefined = undefined;

  if (slug) {
    try {
      const tenant = await prisma.tenant.findFirst({
        where: { OR: [{ slug }, { customDomain: slug }] },
        select: {
          name: true,
          logoUrl: true,
          ownerName: true,
          hasPhysicalLocation: true,
          address: true,
          whatsappNumber: true,
          vertical: true,
          isTriageEnabled: true,
        },
      });
      if (tenant) {
        tenantName = tenant.name;
        tenantLogoUrl = tenant.logoUrl;
        subject = {
          name: tenant.name,
          ownerName: tenant.ownerName,
          address: tenant.hasPhysicalLocation ? tenant.address : null,
          whatsappNumber: tenant.whatsappNumber,
          handlesHealthData: tenant.vertical === "HEALTH" || tenant.isTriageEnabled,
        };
      }
    } catch (e) {
      console.error("[privacy/page.tsx] error fetching tenant:", e);
    }
  }

  return (
    <PrivacyClient
      isRootDomain={isRootDomain}
      tenantName={tenantName}
      tenantLogoUrl={tenantLogoUrl}
      subject={subject}
    />
  );
}
