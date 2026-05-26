"use client";
// src/i18n/index.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Lang, Translations } from "./types";
import { en } from "./en";
import { es } from "./es";

import { useRouter } from "next/navigation";

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
  const router = useRouter();

  useEffect(() => {
    const browserLang = navigator.language || (navigator as any).userLanguage || "en";
    const detected: Lang = browserLang.toLowerCase().startsWith("es") ? "es" : "en";
    
    if (lang !== detected) {
      setLang(detected);
      document.documentElement.lang = detected;
    }
    
    // Check cookie
    const currentCookie = document.cookie.split("; ").find(row => row.startsWith("NEXT_LOCALE="))?.split("=")[1];
    if (currentCookie !== detected) {
      document.cookie = `NEXT_LOCALE=${detected}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [lang, router]);

  return (
    <LanguageContext.Provider value={{ lang, t: dictionaries[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
