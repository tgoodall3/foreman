import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate, PRIORITY_CONFIG } from "@/lib/utils";
import BillingGapClient from "./BillingGapClient";

export const dynamic = "force-dynamic";

export default async function JobsToInvoicePage() {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, priority, scheduled_date, updated_at, properties(id, name, property_manager_id), work_orders(title)")
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "completed")
    .is("invoice_id", null)
    .order("updated_at", { ascending: false });

  return <BillingGapClient jobs={(jobs ?? []) as any[]} />;
}
