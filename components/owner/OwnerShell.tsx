"use client";

import { useState, type JSX } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/owner/NotificationBell";
import { useLanguage } from "@/lib/i18n";
import {
  LayoutDashboard, ClipboardList, Briefcase, CalendarDays,
  Clock, FileText, Receipt, BarChart2, RefreshCcw, Building2,
  Users, Settings, LogOut, Menu, X,
} from "lucide-react";

const NAV_CONFIG = [
  {
    labelKey: "nav.operations",
    items: [
      { href: "/owner",            labelKey: "nav.overview",   icon: LayoutDashboard },
      { href: "/owner/work-orders",labelKey: "nav.workOrders", icon: ClipboardList   },
      { href: "/owner/jobs",       labelKey: "nav.jobs",       icon: Briefcase       },
      { href: "/owner/schedule",   labelKey: "nav.schedule",   icon: CalendarDays    },
      { href: "/owner/timesheets", labelKey: "nav.timesheets", icon: Clock           },
    ],
  },
  {
    labelKey: "nav.revenue",
    items: [
      { href: "/owner/invoices",  labelKey: "nav.invoices",  icon: Receipt  },
      { href: "/owner/estimates", labelKey: "nav.estimates", icon: FileText },
      { href: "/owner/reports",   labelKey: "nav.reports",   icon: BarChart2 },
    ],
  },
  {
    labelKey: "nav.admin",
    items: [
      { href: "/owner/reports/recurring-health", labelKey: "nav.recurring",  icon: RefreshCcw  },
      { href: "/owner/properties",               labelKey: "nav.properties", icon: Building2   },
      { href: "/owner/workers",                  labelKey: "nav.workers",    icon: Users       },
      { href: "/owner/settings/account",         labelKey: "nav.settings",   icon: Settings    },
    ],
  },
];

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

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
    items: section.items.map((item) => ({
      href:  item.href,
      label: t(item.labelKey),
      icon:  item.icon,
    })),
  }));

  const isActive = (href: string) => {
    if (href === "/owner") return pathname === "/owner";
    if (href === "/owner/reports")
      return pathname.startsWith("/owner/reports/") && pathname !== "/owner/reports/recurring-health";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const initial = profile.full_name?.[0]?.toUpperCase() ?? "?";

  const NavLink = ({ href, label, icon: Icon }: NavItem) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        className={[
          "group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
          active
            ? "bg-amber text-forge font-600 shadow-sm"
            : "text-mist font-500 hover:text-white hover:bg-white/8",
        ].join(" ")}
      >
        <Icon
          className={[
            "h-4 w-4 shrink-0 transition-colors",
            active ? "text-forge/80" : "text-mist group-hover:text-white/70",
          ].join(" ")}
          aria-hidden="true"
        />
        <span className="leading-none">{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">

      {/* Mobile top bar */}
      <header className="lg:hidden bg-forge border-b border-white/8 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber shrink-0">
            <span className="font-display font-800 text-forge text-base leading-none">F</span>
          </div>
          <div className="min-w-0">
            <p className="font-display font-800 text-white text-lg leading-none tracking-widest">FOREMAN</p>
            {tenantName && (
              <p className="text-mist text-[11px] truncate mt-0.5 leading-none">{tenantName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-white hover:bg-white/10 transition-colors"
            aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-forge shadow-card-lg flex flex-col z-10">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/8">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber shrink-0">
                  <span className="font-display font-800 text-forge text-base leading-none">F</span>
                </div>
                <div>
                  <p className="font-display font-800 text-white text-lg leading-none tracking-widest">FOREMAN</p>
                  {tenantName && (
                    <p className="text-mist text-[11px] mt-0.5 leading-none truncate">{tenantName}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={t("nav.closeMenu")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
              {NAV_SECTIONS.map((section) => (
                <div key={section.label} className="space-y-0.5">
                  <p className="section-label px-3 mb-2">{section.label}</p>
                  {section.items.map((item) => (
                    <NavLink key={item.href} {...item} />
                  ))}
                </div>
              ))}
            </nav>

            {/* Drawer footer */}
            <div className="border-t border-white/8 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-steel text-white text-sm font-700">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-600 truncate leading-tight">{profile.full_name}</p>
                  <p className="text-mist text-xs mt-0.5">{t("nav.owner")}</p>
                </div>
              </div>
              <form action="/api/auth/signout" method="POST" className="mt-3">
                <button
                  type="submit"
                  className="flex items-center gap-2 text-sm text-mist hover:text-white transition-colors px-1 py-1.5 rounded-lg"
                >
                  <LogOut className="h-4 w-4" />
                  {t("nav.signOut")}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* Desktop sidebar */}
        <aside
          className="hidden lg:flex lg:w-64 xl:w-72 bg-forge flex-col shrink-0 sticky top-0 h-screen overflow-y-auto"
          aria-label="Main navigation"
        >
          {/* Sidebar header */}
          <div className="px-4 py-5 border-b border-white/8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber shrink-0">
                <span className="font-display font-800 text-forge text-lg leading-none">F</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display font-800 text-white text-xl leading-none tracking-widest">FOREMAN</p>
                {tenantName && (
                  <p className="text-mist text-[11px] mt-0.5 truncate leading-none">{tenantName}</p>
                )}
              </div>
              <NotificationBell />
            </div>
          </div>

          {/* Sidebar nav */}
          <nav className="flex-1 px-3 py-5 space-y-5">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label} className="space-y-0.5">
                <p className="section-label px-3 mb-2">{section.label}</p>
                {section.items.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </div>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div className="border-t border-white/8 px-4 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-steel text-white text-xs font-700">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-600 truncate leading-tight">{profile.full_name}</p>
                <p className="text-mist text-[11px] mt-0.5">{t("nav.owner")}</p>
              </div>
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  title={t("nav.signOut")}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-mist hover:text-white hover:bg-white/10 transition-colors"
                  aria-label={t("nav.signOut")}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main
          id="main-content"
          className="flex-1 overflow-auto"
        >
          <div className="w-full max-w-7xl mx-auto">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}
