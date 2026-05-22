import { requireWorker } from "@/lib/auth";
import InactivityTimer from "@/components/ui/InactivityTimer";
import { getServerT } from "@/lib/i18n/server";
import WorkerBottomNav from "@/components/worker/WorkerBottomNav";
import { LogOut } from "lucide-react";

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireWorker();
  const t = await getServerT();

  const initial = profile.full_name?.[0]?.toUpperCase() ?? "W";

  return (
    <div className="min-h-screen bg-surface flex flex-col">

      {/* Top nav */}
      <header className="bg-forge border-b border-white/8 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber shrink-0">
            <span className="font-display font-800 text-forge text-base leading-none">F</span>
          </div>
          <span className="font-display font-800 text-white text-lg tracking-widest">FOREMAN</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-steel shrink-0">
              <span className="text-white text-xs font-700">{initial}</span>
            </div>
            <span className="text-white/80 text-sm font-500 hidden sm:block leading-none">
              {profile.full_name}
            </span>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-mist hover:text-white hover:bg-white/10 transition-colors"
              aria-label={t("nav.signOut")}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </header>

      <InactivityTimer />

      <main id="main-content" className="flex-1 pb-20">
        {children}
      </main>

      <WorkerBottomNav />
    </div>
  );
}
