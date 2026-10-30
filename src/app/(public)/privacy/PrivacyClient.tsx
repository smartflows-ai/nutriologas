// src/app/(public)/privacy/PrivacyClient.tsx
"use client";

import { useTranslation } from "@/i18n";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import { getPrivacyPolicy, type LegalSubject } from "@/components/legal/legalContent";

interface Props {
  isRootDomain: boolean;
  tenantName?: string;
  tenantLogoUrl?: string | null;
  subject?: LegalSubject;
}

export default function PrivacyClient({ isRootDomain, tenantName, tenantLogoUrl, subject }: Props) {
  const { lang } = useTranslation();
  const doc = getPrivacyPolicy(lang, subject);

  return (
    <LegalPageLayout
      document={doc}
      activeDoc="privacy"
      isRootDomain={isRootDomain}
      tenantName={tenantName}
      tenantLogoUrl={tenantLogoUrl}
    />
  );
}
