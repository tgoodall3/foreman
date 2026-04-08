import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate } from "@/lib/utils";
import WorkersClient from "./WorkersClient";

export default async function WorkersPage() {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: workers } = await supabase
    .from("profiles")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .eq("role", "worker")
    .order("created_at", { ascending: false });

  return <WorkersClient workers={workers || []} tenantId={profile.tenant_id} />;
}
