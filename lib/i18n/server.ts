import { cookies } from "next/headers";
import en, { TranslationKeys } from "./en";
import es from "./es";

type Locale = "en" | "es";
const translations: Record<Locale, TranslationKeys> = { en, es };

function getNestedValue(obj: any, path: string): string {
  return path.split(".").reduce((acc, key) => acc?.[key], obj) ?? path;
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, key) => vars[key]?.toString() ?? `{${key}}`);
}

export async function getServerT() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("foreman_locale")?.value ?? "en") as Locale;
  const dict = translations[locale] ?? en;
  return function t(path: string, vars?: Record<string, string | number>): string {
    const raw = getNestedValue(dict, path);
    return interpolate(raw, vars);
  };
}
