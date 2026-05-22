import { createServerSideClient } from "@/lib/supabase-server";
import { getProfile } from "@/lib/auth";
import { differenceInDays, parseISO } from "date-fns";
import Link from "next/link";
import { getServerT } from "@/lib/i18n/server";
import { Zap, AlertTriangle } from "lucide-react";

export default async function TrialBanner() {
  const profile = await getProfile();
  if (!profile) return null;
  if ((profile as any).plan === "pro") return null;

  const t = await getServerT();
  const supabase = await createServerSideClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("plan, trial_ends_at")
    .eq("id", profile.tenant_id)
    .single();

  if (!tenant || tenant.plan === "pro" || !tenant.trial_ends_at) return null;

  const daysLeft = differenceInDays(parseISO(tenant.trial_ends_at), new Date());
  if (daysLeft > 10) return null;

  const isExpired = daysLeft < 0;

  return (
    <div
      className={`flex items-center justify-between gap-4 px-5 py-2.5 text-sm ${
        isExpired
          ? "bg-red-600 text-white"
          : "bg-amber/15 border-b border-amber/30 text-forge"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isExpired
          ? <AlertTriangle className="h-4 w-4 shrink-0" />
          : <Zap className="h-4 w-4 shrink-0 text-amber-dark" />}
        <p className="font-600 truncate">
          {isExpired
            ? t("trial.expired")
            : t("trial.daysLeft", { days: daysLeft, plural: daysLeft === 1 ? "" : "s" })}
        </p>
      </div>
      <Link
        href="/owner/settings/billing"
        className={`shrink-0 font-display font-700 text-xs px-3 py-1.5 rounded-lg transition-colors ${
          isExpired
            ? "bg-white text-red-600 hover:bg-red-50"
            : "bg-forge text-white hover:bg-forge-light shadow-sm"
        }`}
      >
        {t("trial.upgradeNow")}
      </Link>
    </div>
  );
}
