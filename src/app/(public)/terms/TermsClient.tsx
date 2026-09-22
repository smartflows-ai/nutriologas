// src/app/(public)/terms/TermsClient.tsx
"use client";

import { useTranslation } from "@/i18n";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import { getTermsOfService } from "@/components/legal/legalContent";

interface Props {
  isRootDomain: boolean;
  tenantName?: string;
  tenantLogoUrl?: string | null;
}

export default function TermsClient({ isRootDomain, tenantName, tenantLogoUrl }: Props) {
  const { lang } = useTranslation();
  const doc = getTermsOfService(lang, tenantName);

  return (
    <LegalPageLayout
      document={doc}
      activeDoc="terms"
      isRootDomain={isRootDomain}
      tenantName={tenantName}
      tenantLogoUrl={tenantLogoUrl}
    />
  );
}
