"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import en, { TranslationKeys } from "./en";
import es from "./es";

type Locale = "en" | "es";

const translations: Record<Locale, TranslationKeys> = { en, es };

const STORAGE_KEY = "foreman_locale";

function getNestedValue(obj: any, path: string): string {
  return path.split(".").reduce((acc, key) => acc?.[key], obj) ?? path;
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, key) => vars[key]?.toString() ?? `{${key}}`);
}

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (path) => path,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved === "en" || saved === "es") {
      setLocaleState(saved);
      document.cookie = `foreman_locale=${saved};path=/;max-age=31536000`;
    }
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `foreman_locale=${next};path=/;max-age=31536000`;
  };

  const t = (path: string, vars?: Record<string, string | number>) => {
    const raw = getNestedValue(translations[locale], path);
    return interpolate(raw, vars);
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
