import Link from "next/link";

const SETTINGS_NAV = [
  { href: "/owner/settings/billing", label: "Billing" },
  { href: "/owner/settings/account", label: "Account" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 max-w-4xl">
      <h1 className="font-display font-800 text-3xl text-forge mb-6">Settings</h1>
      <div className="flex gap-8">
        <nav className="w-40 shrink-0" aria-label="Settings navigation">
          <ul className="space-y-1">
            {SETTINGS_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href}
                  className="block px-3 py-2 rounded-lg text-sm font-500 text-mist hover:text-forge hover:bg-gray-100 transition-colors">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
