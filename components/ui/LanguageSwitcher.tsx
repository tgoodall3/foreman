"use client";

import { useLanguage } from "@/lib/i18n";

interface Props {
  variant?: "light" | "dark";
}

export default function LanguageSwitcher({ variant = "dark" }: Props) {
  const { locale, setLocale, t } = useLanguage();

  const base = "flex items-center gap-1 text-sm font-500 rounded-lg px-3 py-1.5 transition-colors";
  const active = variant === "dark"
    ? "bg-amber text-forge"
    : "bg-white text-forge";
  const inactive = variant === "dark"
    ? "text-mist hover:text-white"
    : "text-gray-400 hover:text-gray-600";

  return (
    <div className="flex items-center gap-1" aria-label={t("language.label")}>
      <button
        onClick={() => setLocale("en")}
        className={`${base} ${locale === "en" ? active : inactive}`}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
      <button
        onClick={() => setLocale("es")}
        className={`${base} ${locale === "es" ? active : inactive}`}
        aria-pressed={locale === "es"}
      >
        ES
      </button>
    </div>
  );
}
