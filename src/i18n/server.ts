import { cookies } from "next/headers";
import { en } from "./en";
import { es } from "./es";
import type { Translations } from "./types";

export function getTranslationServer(): Translations {
  const cookieStore = cookies();
  const langValue = cookieStore.get("NEXT_LOCALE")?.value;
  const lang = langValue === "es" ? "es" : "en";
  return lang === "es" ? es : en;
}
