"use client";

import { useState, type JSX } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/owner/NotificationBell";
import { useLanguage } from "@/lib/i18n";

const ICONS: Record<string, JSX.Element> = {
  today: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M9 3v4M15 3v4M4 10h16" />
    </svg>
  ),
  tasks: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  ),
  briefcase: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="7" width="16" height="12" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  schedule: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  invoice: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3h10l2 4v12H5V3h2z" />
      <path d="M9 9h6M9 13h4" />
    </svg>
  ),
  doc: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 4h9l3 3v13H6V4z" />
      <path d="M14 4v4h4" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  ),
  report: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20h16V4H4z" />
      <path d="M9 15v-5M13 15v-3M17 15v-7" />
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 12 12 5l8 7" />
      <path d="M5 11v9h14v-9" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="9" r="3" />
      <path d="M4 19c0-2.5 2-4.5 5-4.5s5 2 5 4.5M13 16.5c.6-.3 1.3-.5 2-.5 3 0 5 2 5 4.5" />
    </svg>
  ),
  billing: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M4 10h16M8 14h2" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V2a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H22a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

const NAV_CONFIG = [
  {
    labelKey: "nav.operations",
    items: [
      { href: "/owner", labelKey: "nav.overview", icon: ICONS.today },
      { href: "/owner/work-orders", labelKey: "nav.workOrders", icon: ICONS.tasks },
      { href: "/owner/jobs", labelKey: "nav.jobs", icon: ICONS.briefcase },
      { href: "/owner/schedule", labelKey: "nav.schedule", icon: ICONS.schedule },
      { href: "/owner/timesheets", labelKey: "nav.timesheets", icon: ICONS.clock },
    ],
  },
  {
    labelKey: "nav.revenue",
    items: [
      { href: "/owner/invoices", labelKey: "nav.invoices", icon: ICONS.invoice },
      { href: "/owner/estimates", labelKey: "nav.estimates", icon: ICONS.doc },
      { href: "/owner/reports", labelKey: "nav.reports", icon: ICONS.report },
    ],
  },
  {
    labelKey: "nav.admin",
    items: [
      { href: "/owner/reports/recurring-health", labelKey: "nav.recurring", icon: ICONS.report },
      { href: "/owner/properties", labelKey: "nav.properties", icon: ICONS.home },
      { href: "/owner/workers", labelKey: "nav.workers", icon: ICONS.users },
      { href: "/owner/settings/account", labelKey: "nav.settings", icon: ICONS.settings },
    ],
  },
];

interface OwnerShellProps {
  profile: { full_name: string };
  tenantName?: string;
  children: React.ReactNode;
}

export default function OwnerShell({ profile, tenantName, children }: OwnerShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useLanguage();

  const NAV_SECTIONS = NAV_CONFIG.map((section) => ({
    label: t(section.labelKey),
    items: section.items.map((item) => ({ href: item.href, label: t(item.labelKey), icon: item.icon })),
  }));

  const isActive = (href: string) => {
    if (href === "/owner") return pathname === "/owner";
    if (href === "/owner/reports") return pathname.startsWith("/owner/reports/") && pathname !== "/owner/reports/recurring-health";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const NavLink = ({ href, label, icon }: { href: string; label: string; icon: JSX.Element }) => (
    <Link
      key={href}
      href={href}
      className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm font-500 transition-colors ${
        isActive(href)
          ? "bg-amber text-forge font-600"
          : "text-mist hover:text-white hover:bg-forge-light"
      }`}
      onClick={() => setMobileOpen(false)}
    >
      <span className="text-base w-5 text-center" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      {isActive(href) && <span className="ml-auto text-xs">✓</span>}
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <header className="lg:hidden bg-forge px-4 py-3 flex items-center justify-between border-b border-steel">
        <div className="flex items-center gap-2">
          <div className="rounded overflow-hidden h-8 w-8 shrink-0">
            <Image src="/logo_inverse.png" alt="Foreman" width={32} height={32} className="h-8 w-auto" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-800 text-white text-lg leading-none tracking-wide">FOREMAN</p>
            <p className="text-mist text-xs truncate">{tenantName || t("nav.yourBusiness")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="text-white p-2 hover:bg-forge-light rounded-lg transition-colors"
          aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
          aria-expanded={mobileOpen}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-0 h-full w-full max-w-[320px] bg-forge shadow-2xl p-4 overflow-y-auto z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="font-display font-800 text-white text-lg">{t("nav.menu")}</p>
                <p className="text-mist text-xs">{tenantName || t("nav.yourBusiness")}</p>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-white p-2 hover:bg-forge-light rounded-lg transition-colors"
                aria-label={t("nav.closeMenu")}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="space-y-4">
              {NAV_SECTIONS.map((section) => (
                <div key={section.label} className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-mist font-700 px-1">{section.label}</p>
                  {section.items.map((item) => (
                    <NavLink key={item.href} {...item} />
                  ))}
                </div>
              ))}
            </nav>

            <div className="mt-6 border-t border-steel pt-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-steel rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-700">{profile.full_name[0]}</span>
                </div>
                <div>
                  <p className="text-white text-sm font-600 truncate">{profile.full_name}</p>
                  <p className="text-mist text-xs">{t("nav.owner")}</p>
                </div>
              </div>
              <form action="/api/auth/signout" method="POST" className="mt-4">
                <button type="submit" className="w-full text-left text-sm text-mist hover:text-white px-3 py-2 rounded-lg transition-colors">
                  {t("nav.signOut")} →
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1">
        <aside className="hidden lg:flex lg:w-72 bg-forge flex-col shrink-0" aria-label="Main navigation">
          <div className="px-4 py-5 border-b border-steel">
            <div className="flex items-center gap-2">
              <div className="rounded overflow-hidden h-8 w-8 shrink-0">
                <Image src="/logo_inverse.png" alt="Foreman" width={32} height={32} className="h-8 w-auto" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display font-800 text-white text-lg leading-none tracking-wide">FOREMAN</p>
                <p className="text-mist text-xs truncate mt-0.5">{tenantName || "Your Business"}</p>
              </div>
              <NotificationBell />
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-4">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label} className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.2em] text-mist font-700 px-2">{section.label}</p>
                {section.items.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </div>
            ))}
          </nav>

          <div className="px-4 py-4 border-t border-steel">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-steel rounded-full flex items-center justify-center shrink-0">
                <span className="text-white text-sm font-700">{profile.full_name[0]}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-600 truncate">{profile.full_name}</p>
                <p className="text-mist text-xs">{t("nav.owner")}</p>
              </div>
              <form action="/api/auth/signout" method="POST">
                <button type="submit" className="text-mist hover:text-white text-xs transition-colors" aria-label={t("nav.signOut")}>
                  →
                </button>
              </form>
            </div>
          </div>
        </aside>

        <main id="main-content" className="flex-1 overflow-auto flex flex-col min-h-0 px-4 py-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-7xl mx-auto flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
