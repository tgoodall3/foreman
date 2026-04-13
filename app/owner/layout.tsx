import TrialBanner from "@/components/ui/TrialBanner";
import InactivityTimer from "@/components/ui/InactivityTimer";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import OwnerShell from "@/components/owner/OwnerShell";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", profile.tenant_id)
    .single();

  return (
    <OwnerShell profile={profile} tenantName={tenant?.name}>
      <TrialBanner />
      <InactivityTimer />
      {children}
    </OwnerShell>
  );
}
