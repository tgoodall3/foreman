import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate } from "@/lib/utils";
import BillingClient from "./BillingClient";

export default async function BillingPage() {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", profile.tenant_id)
    .single();

  return <BillingClient tenant={tenant} profile={profile} />;
}
