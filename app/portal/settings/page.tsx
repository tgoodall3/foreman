import { getProfile } from "@/lib/auth";
import Link from "next/link";
import PortalSettingsForm from "./PortalSettingsForm";

export default async function PortalSettingsPage() {
  const profile = await getProfile();
  if (!profile) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white rounded-2xl border border-gray-200 p-8">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="font-display font-800 text-xl text-forge mb-2">Access required</h1>
          <p className="text-mist text-sm">Please sign in to access your settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-forge px-4 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber rounded flex items-center justify-center shrink-0">
              <span className="font-display font-800 text-forge text-base leading-none">F</span>
            </div>
            <p className="font-display font-800 text-white text-lg leading-none tracking-wide">Foreman</p>
          </div>
          <Link href="/login" className="text-white/60 hover:text-white text-sm font-600 transition-colors">
            Sign out
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 py-6 space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="font-display font-800 text-2xl text-forge">Account Settings</h1>
        </div>
        <PortalSettingsForm profile={profile} />
      </main>
    </div>
  );
}
