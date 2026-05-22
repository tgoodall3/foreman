"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Clock, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/worker",            labelKey: "My Jobs",    icon: Briefcase },
  { href: "/worker/timesheets", labelKey: "Timesheets", icon: Clock     },
  { href: "/worker/settings",   labelKey: "Settings",   icon: Settings  },
] as const;

export default function WorkerBottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/worker" ? pathname === "/worker" : pathname.startsWith(href);

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] flex"
      aria-label="Worker navigation"
    >
      {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={[
              "relative flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors min-h-[56px]",
              active ? "text-forge" : "text-mist hover:text-steel",
            ].join(" ")}
            aria-current={active ? "page" : undefined}
          >
            <Icon
              className={`h-5 w-5 transition-all ${active ? "stroke-[2.2px]" : "stroke-[1.8px]"}`}
              aria-hidden="true"
            />
            <span className={`text-[11px] font-600 leading-none ${active ? "text-forge" : ""}`}>
              {labelKey}
            </span>
            {active && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-amber" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
