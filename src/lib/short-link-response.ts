// src/lib/short-link-response.ts
// Responses shared by the short-link routes (/ubicacion and /online/<code>). Nothing here names a provider, and the
// text is plain Spanish without emojis: the customer may open the link from any device.
import { NextResponse } from "next/server";

/** Short links answer the same way in every case and are never cached or shared with a referrer. */
export const SHORT_LINK_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};

const PAGE = (titulo: string, mensaje: string) =>
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>` +
  `<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;background:#F6F7F9;color:#18191D}` +
  `main{max-width:460px;padding:32px;text-align:center}h1{font-size:22px;margin:0 0 12px}p{color:#676C76;line-height:1.5;margin:0}</style></head>` +
  `<body><main><h1>${titulo}</h1><p>${mensaje}</p></main></body></html>`;

/** A short link that does not lead anywhere (unknown, expired, or no location published). */
export function shortLinkUnavailable(titulo: string, mensaje: string, status: 404 | 410 = 404): NextResponse {
  return new NextResponse(PAGE(titulo, mensaje), {
    status,
    headers: { ...SHORT_LINK_HEADERS, "Content-Type": "text/html; charset=utf-8" },
  });
}
