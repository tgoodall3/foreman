import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import AccountClient from "./AccountClient";

export default async function AccountPage() {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();
  const { data: tenant } = await supabase.from("tenants").select("*").eq("id", profile.tenant_id).single();
  return <AccountClient profile={profile} tenant={tenant} />;
}
