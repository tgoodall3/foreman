import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import OnboardingWizard from "./OnboardingWizard";

export default async function OnboardingPage() {
  const profile  = await requireOwner();
  const supabase = await createServerSideClient();

  // If already set up, skip to dashboard
  const [{ count: workerCount }, { count: pmCount }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true })
      .eq("tenant_id", profile.tenant_id).eq("role", "worker"),
    supabase.from("property_managers").select("id", { count: "exact", head: true })
      .eq("tenant_id", profile.tenant_id),
  ]);

  if ((workerCount ?? 0) > 0 && (pmCount ?? 0) > 0) redirect("/owner");

  const { data: tenant } = await supabase
    .from("tenants").select("name, id").eq("id", profile.tenant_id).single();

  return <OnboardingWizard tenantId={profile.tenant_id} tenantName={tenant?.name ?? ""} />;
}
