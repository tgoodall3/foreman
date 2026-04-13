import { createServerSideClient } from "@/lib/supabase-server";
import { getProfile } from "@/lib/auth";
import { differenceInDays, parseISO } from "date-fns";
import Link from "next/link";

export default async function TrialBanner() {
  const profile = await getProfile();
  if (!profile) return null;
  // Profile already upgraded — skip the DB round-trip
  if ((profile as any).plan === "pro") return null;

  const supabase = await createServerSideClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("plan, trial_ends_at")
    .eq("id", profile.tenant_id)
    .single();

  if (!tenant || tenant.plan === "pro" || !tenant.trial_ends_at) return null;

  const daysLeft = differenceInDays(parseISO(tenant.trial_ends_at), new Date());

  if (daysLeft > 10) return null; // Show banner starting 10 days before end

  const isExpired = daysLeft < 0;

  return (
    <div className={`px-6 py-2 text-sm flex items-center justify-between ${isExpired ? "bg-red-600" : "bg-amber"}`}>
      <p className={`font-600 ${isExpired ? "text-white" : "text-forge"}`}>
        {isExpired
          ? "Your trial has expired. Upgrade to continue using Foreman."
          : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your free trial.`}
      </p>
      <Link
        href="/owner/settings/billing"
        className={`font-display font-700 text-xs px-3 py-1.5 rounded-lg transition-colors ${
          isExpired ? "bg-white text-red-600 hover:bg-red-50" : "bg-forge text-white hover:bg-forge-light"
        }`}
      >
        Upgrade Now {"\u2192"}
      </Link>
    </div>
  );
}

