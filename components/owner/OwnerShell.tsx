"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/owner",            label: "Dashboard",   icon: "⬡" },
  { href: "/owner/schedule",   label: "Schedule",    icon: "📅" },
  { href: "/owner/jobs",       label: "Jobs",        icon: "🔨" },
  { href: "/owner/estimates",  label: "Estimates",   icon: "📝" },
  { href: "/owner/work-orders",label: "Work Orders", icon: "📋" },
  { href: "/owner/workers",    label: "Workers",     icon: "👷" },
  { href: "/owner/timesheets", label: "Timesheets",  icon: "⏱" },
  { href: "/owner/properties", label: "Properties",  icon: "🏢" },
  { href: "/owner/invoices",   label: "Invoices",    icon: "💵" },
  { href: "/owner/settings",   label: "Settings",    icon: "⚙" },
];

interface OwnerShellProps {
  profile: { full_name: string };
  tenantName?: string;
  children: React.ReactNode;
}

export default function OwnerShell({ profile, tenantName, children }: OwnerShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

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

            <nav className="space-y-2">
              {NAV.map((item) => {
                const isActive = item.href === "/owner"
                  ? pathname === "/owner"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-colors ${
                      isActive
                        ? 'bg-amber/20 text-white font-600'
                        : 'text-white hover:bg-forge-light'
                    }`}
                  >
                    <span className="w-5 text-center" aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
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
                  Sign out ↩
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

          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV.map((item) => {
              const isActive = item.href === "/owner"
                ? pathname === "/owner"
                : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm font-500 transition-colors ${
                    isActive
                      ? 'bg-amber text-forge font-600'  // Active state
                      : 'text-mist hover:text-white hover:bg-forge-light'
                  }`}
                >
                  <span className="text-base w-5 text-center" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                  {isActive && <span className="ml-auto text-xs">✓</span>}
                </Link>
              );
            })}
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
                  ↩
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
