import { headers } from "next/headers";
import { en } from "./en";
import { es } from "./es";
import type { Translations } from "./types";
import type { AppLocale } from "@/lib/utils";

// Intl locale for numbers and dates on the server, from the same accept-language header.
export function getLocaleServer(): AppLocale {
  const acceptLanguage = headers().get("accept-language")?.toLowerCase() || "";
  const primary = acceptLanguage.split(",")[0]?.trim() || "";
  return primary.startsWith("es") ? "es-MX" : "en-US";
}

export function getTranslationServer(): Translations {
  const headersList = headers();
  const acceptLanguage = headersList.get("accept-language")?.toLowerCase() || "";
  const primary = acceptLanguage.split(",")[0]?.trim() || "";
  const lang = primary.startsWith("es") ? "es" : "en";
  return lang === "es" ? es : en;
}
