// src/app/(public)/terms/TermsClient.tsx
"use client";

import { useTranslation } from "@/i18n";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import { getTermsOfService, type LegalSubject } from "@/components/legal/legalContent";

interface Props {
  isRootDomain: boolean;
  tenantName?: string;
  tenantLogoUrl?: string | null;
  subject?: LegalSubject;
}

export default function TermsClient({ isRootDomain, tenantName, tenantLogoUrl, subject }: Props) {
  const { lang } = useTranslation();
  const doc = getTermsOfService(lang, subject);

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
