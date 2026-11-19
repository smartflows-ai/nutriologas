// src/lib/tenant-metadata.ts
// What a link preview (WhatsApp, Facebook, iMessage) shows for a business page (ticket #116): its name, a short
// description and an image, in the business language. The reader of a preview sends no Spanish accept-language, so
// the language comes from the business (Tenant.messageLanguage), never from the request. Pure: no I/O.
import { tenantPublicUrl } from "@/lib/tenant-url";

const MAX_DESCRIPTION = 160;
const WELCOME = { es: "Bienvenido a {name}", en: "Welcome to {name}" } as const;
const LOCALE = { es: "es_MX", en: "en_US" } as const;
const HOSTED_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

export type PreviewLang = keyof typeof WELCOME;

export interface TenantPreviewInput {
  readonly name: string;
  readonly slug: string;
  readonly customDomain: string | null;
  readonly businessInfo: string | null;
  readonly logoUrl: string | null;
  readonly messageLanguage: string | null;
  /** First active carousel image or service photo, used when there is no logo. */
  readonly fallbackImage: string | null;
}

export interface TenantPreview {
  readonly lang: PreviewLang;
  readonly locale: string;
  readonly title: string;
  readonly description: string;
  readonly url: string;
  readonly image: string | null;
}

function previewLang(value: string | null): PreviewLang {
  return value === "en" ? "en" : "es";
}

/** One line, cut at the last whole word before the limit. */
function shortText(value: string): string {
  const line = value.replace(/\s+/g, " ").trim();
  if (line.length <= MAX_DESCRIPTION) return line;
  const cut = line.slice(0, MAX_DESCRIPTION);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:]+$/, "")}…`;
}

/** A hosted image as a jpg of at most 600 px wide: previews skip svg and very large files. */
export function previewImageUrl(url: string): string {
  const match = HOSTED_UPLOAD.exec(url);
  return match ? `${match[1]}f_jpg,w_600,c_limit/${match[2]}` : url;
}

function usableImage(url: string | null): string | null {
  return url && url.startsWith("https://") ? previewImageUrl(url) : null;
}

export function tenantPreview(input: TenantPreviewInput, rootDomain?: string): TenantPreview {
  const lang = previewLang(input.messageLanguage);
  const info = input.businessInfo ? shortText(input.businessInfo) : "";
  return {
    lang,
    locale: LOCALE[lang],
    title: input.name,
    description: info || WELCOME[lang].replace("{name}", input.name),
    url: tenantPublicUrl({ slug: input.slug, customDomain: input.customDomain }, "", rootDomain),
    image: usableImage(input.logoUrl) ?? usableImage(input.fallbackImage),
  };
}
