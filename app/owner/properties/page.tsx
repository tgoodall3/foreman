import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import PropertiesClient from "./PropertiesClient";

export default async function PropertiesPage() {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: pms } = await supabase
    .from("property_managers")
    .select("*, properties(*)")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  return (
    <PropertiesClient
      propertyManagers={pms || []}
      tenantId={profile.tenant_id}
      appUrl={process.env.NEXT_PUBLIC_APP_URL || ""}
    />
  );
}
