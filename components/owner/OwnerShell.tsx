"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

const NAV_SECTIONS = [
  {
    label: "Today",
    items: [
      { href: "/owner", label: "Overview", icon: ICONS.today },
      { href: "/owner/work-orders", label: "Work Orders", icon: ICONS.tasks },
      { href: "/owner/jobs", label: "Jobs", icon: ICONS.briefcase },
      { href: "/owner/schedule", label: "Schedule", icon: ICONS.schedule },
      { href: "/owner/timesheets", label: "Timesheets", icon: ICONS.clock },
    ],
  },
  {
    label: "Revenue",
    items: [
      { href: "/owner/invoices", label: "Invoices", icon: ICONS.invoice },
      { href: "/owner/estimates", label: "Estimates", icon: ICONS.doc },
      { href: "/owner/reports/jobs-to-invoice", label: "Billing Gap", icon: ICONS.report },
      { href: "/owner/reports/estimate-conversion", label: "Conversions", icon: ICONS.report },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/owner/reports/recurring-health", label: "Recurring", icon: ICONS.report },
      { href: "/owner/properties", label: "Properties", icon: ICONS.home },
      { href: "/owner/workers", label: "Workers", icon: ICONS.users },
      { href: "/owner/settings/billing", label: "Billing", icon: ICONS.billing },
      { href: "/owner/settings", label: "Settings", icon: ICONS.settings },
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

  const isActive = (href: string) => {
    if (href === "/owner") return pathname === "/owner";
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
          <div className="w-8 h-8 bg-amber rounded flex items-center justify-center">
            <span className="font-display font-800 text-forge text-lg">F</span>
          </div>
          <div className="min-w-0">
            <p className="font-display font-800 text-white text-lg leading-none tracking-wide">FOREMAN</p>
            <p className="text-mist text-xs truncate">{tenantName || "Your Business"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="text-white p-2 hover:bg-forge-light rounded-lg transition-colors"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
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
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-0 h-full w-full max-w-[320px] bg-forge shadow-2xl p-4 overflow-y-auto z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="font-display font-800 text-white text-lg">Menu</p>
                <p className="text-mist text-xs">{tenantName || "Your Business"}</p>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-white p-2 hover:bg-forge-light rounded-lg transition-colors"
                aria-label="Close menu"
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
                  <p className="text-mist text-xs">Owner</p>
                </div>
              </div>
              <form action="/api/auth/signout" method="POST" className="mt-4">
                <button type="submit" className="w-full text-left text-sm text-mist hover:text-white px-3 py-2 rounded-lg transition-colors">
                  Sign out →
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
              <div className="w-8 h-8 bg-amber rounded flex items-center justify-center shrink-0">
                <span className="font-display font-800 text-forge text-lg">F</span>
              </div>
              <div className="min-w-0">
                <p className="font-display font-800 text-white text-lg leading-none tracking-wide">FOREMAN</p>
                <p className="text-mist text-xs truncate mt-0.5">{tenantName || "Your Business"}</p>
              </div>
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
                <p className="text-mist text-xs">Owner</p>
              </div>
              <form action="/api/auth/signout" method="POST">
                <button type="submit" className="text-mist hover:text-white text-xs transition-colors" aria-label="Sign out">
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
