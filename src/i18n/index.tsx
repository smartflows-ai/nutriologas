"use client";
// src/i18n/index.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Lang, Translations } from "./types";
import { en } from "./en";
import { es } from "./es";


const dictionaries: Record<Lang, Translations> = { en, es };

interface LanguageContextValue {
  lang: Lang;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  t: en,
});

export function LanguageProvider({ children, initialLang = "en" }: { children: ReactNode; initialLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    // Clear any past sticky cookies so they don't interfere
    try {
      document.cookie = "NEXT_LOCALE=; path=/; max-age=0";
      document.cookie = "USER_LOCALE_MANUAL=; path=/; max-age=0";
      localStorage.removeItem("USER_LOCALE_MANUAL");
    } catch {}

    // Language is strictly gotten from the browser settings:
    // navigator.languages[0] reflects the top/primary language in browser settings
    const primary = (
      (typeof navigator !== "undefined" && navigator.languages && navigator.languages.length > 0
        ? navigator.languages[0]
        : typeof navigator !== "undefined"
        ? navigator.language
        : "") || ""
    ).toLowerCase();

    const detected: Lang = primary.startsWith("es") ? "es" : "en";

    if (lang !== detected) {
      setLang(detected);
    }
    document.documentElement.lang = detected;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, t: dictionaries[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
