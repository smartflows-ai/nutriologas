import { headers } from "next/headers";
import { en } from "./en";
import { es } from "./es";
import type { Translations } from "./types";

export function getTranslationServer(): Translations {
  const headersList = headers();
  const acceptLanguage = headersList.get("accept-language")?.toLowerCase() || "";
  const primary = acceptLanguage.split(",")[0]?.trim() || "";
  const lang = primary.startsWith("es") ? "es" : "en";
  return lang === "es" ? es : en;
}
