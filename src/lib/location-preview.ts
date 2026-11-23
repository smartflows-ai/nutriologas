// src/lib/location-preview.ts
// Link preview of <tenant>.newaigent.com/ubicacion (ticket #142). Chat apps build their card from the page they reach;
// a bare 302 to Google Maps made WhatsApp show a generic map. Preview crawlers get a short page with og: tags (business
// name, address, logo); everyone else keeps the redirect. A crawler we do not list simply gets today's redirect.

const CRAWLER_RE = /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|slackbot|linkedinbot|discordbot|signal|skypeuripreview/i;

/** True when the user agent belongs to a link-preview crawler (never a person's browser). */
export function isPreviewCrawler(userAgent: string | null | undefined): boolean {
  return !!userAgent && CRAWLER_RE.test(userAgent);
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const LABEL = { es: "Cómo llegar", en: "Directions" } as const;

export interface LocationPreviewInput {
  name: string;
  address: string;
  logoUrl?: string | null;
  /** Business language (`es` or `en`); Spanish when missing. */
  language?: string | null;
}

/** Short HTML page with the og: tags. Carries no phone and no private data: only name, address and logo. */
export function buildLocationPreviewHtml(input: LocationPreviewInput): string {
  const lang = input.language === "en" ? "en" : "es";
  const name = escapeHtml(input.name.trim());
  const address = escapeHtml(input.address.trim());
  const logo = input.logoUrl && /^https:\/\//i.test(input.logoUrl.trim()) ? escapeHtml(input.logoUrl.trim()) : null;
  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${name}">`,
    `<meta property="og:description" content="${address}">`,
    ...(logo ? [`<meta property="og:image" content="${logo}">`] : []),
  ].join("");
  return (
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${name}</title>${tags}</head>` +
    `<body><h1>${name}</h1><p>${LABEL[lang]}: ${address}</p></body></html>`
  );
}
