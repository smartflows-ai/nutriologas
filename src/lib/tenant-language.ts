// src/lib/tenant-language.ts
// Server only. The texts of a page that a business shows to anyone (link previews, its 404 page) are in the business
// language (Tenant.messageLanguage), not in the reader's: a preview reader sends no Spanish accept-language
// (ticket #116). The marketing pages keep following the browser.
import { prisma } from "@/lib/db";
import { getTenantSlug } from "@/lib/tenant";
import { getTranslationServer } from "@/i18n/server";
import { en } from "@/i18n/en";
import { es } from "@/i18n/es";
import type { Translations } from "@/i18n/types";

export async function getBusinessTranslationServer(): Promise<Translations> {
  const slug = getTenantSlug();
  if (!slug) return getTranslationServer();
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ slug }, { customDomain: slug }] },
      select: { messageLanguage: true },
    });
    if (!tenant) return getTranslationServer();
    return tenant.messageLanguage === "en" ? en : es;
  } catch {
    return getTranslationServer();
  }
}
