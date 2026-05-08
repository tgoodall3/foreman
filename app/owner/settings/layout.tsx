"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();

  const SETTINGS_NAV = [
    { href: "/owner/settings/billing", label: t("billing.title") },
    { href: "/owner/settings/account", label: t("settings.account") },
  ];

  return (
    <div className="page-shell page-shell-standard lg:px-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="page-title">{t("settings.settingsTitle")}</h1>
        <div className="flex flex-col gap-8 lg:flex-row">
          <nav className="w-full lg:w-40 shrink-0 surface-card p-4" aria-label="Settings navigation">
            <ul className="space-y-1">
              {SETTINGS_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}
                    className="block rounded-2xl px-3 py-3 text-sm font-500 text-steel hover:text-forge hover:bg-gray-100 transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
