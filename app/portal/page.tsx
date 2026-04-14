import { createServiceClient } from "@/lib/supabase";
import { requirePortalPm } from "@/lib/portal";
import PortalDashboard from "@/components/portal/PortalDashboard";

export const dynamic = "force-dynamic";

export default async function PortalPage({ searchParams }: { searchParams: { tab?: string; paid?: string } }) {
  const pm = await requirePortalPm("id, tenant_id, full_name, email, company, is_active, tenants(name)");

  const supabase = createServiceClient();

  // All PM IDs sharing the same email within this tenant (handles re-invites / duplicates)
  let propertyManagerIds = [pm.id];
  if (pm.email) {
    const { data: aliases } = await supabase
      .from("property_managers")
      .select("id")
      .eq("tenant_id", pm.tenant_id)
      .eq("email", pm.email);
    if (aliases && aliases.length > 0) {
      propertyManagerIds = Array.from(new Set(aliases.map((a: { id: string }) => a.id)));
    }
  }

  const [
    { data: properties },
    { data: workOrders },
    { data: invoices },
    { data: estimates },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, address, city, state, zip, property_manager_id")
      .in("property_manager_id", propertyManagerIds)
      .order("name"),

    supabase
      .from("work_orders")
      .select("id, title, status, priority, created_at, photos, properties(name)")
      .in("property_manager_id", propertyManagerIds)
      .order("created_at", { ascending: false }),

    supabase
      .from("invoices")
      .select("id, invoice_number, status, total, subtotal, tax_rate, tax_amount, due_date, created_at, notes, line_items, jobs(title)")
      .in("property_manager_id", propertyManagerIds)
      .order("created_at", { ascending: false }),

    supabase
      .from("estimates")
      .select("id, estimate_number, status, total, title, created_at, approval_token")
      .in("property_manager_id", propertyManagerIds)
      .order("created_at", { ascending: false }),
  ]);

  let comments: any[] = [];
  const workOrderIds = (workOrders ?? []).map((w: any) => w.id);
  if (workOrderIds.length > 0) {
    const { data } = await supabase
      .from("work_order_comments")
      .select("id, work_order_id, message, created_at, property_manager:property_managers!work_order_comments_created_by_pm_fkey(full_name)")
      .eq("tenant_id", pm.tenant_id)
      .in("work_order_id", workOrderIds)
      .order("created_at", { ascending: true });
    comments = data ?? [];
  }

  let jobInfoMap: Record<string, { status: string; scheduled_date?: string | null; scheduled_time?: string | null }> = {};
  if (workOrderIds.length) {
    const { data: woJobs } = await supabase
      .from("jobs")
      .select("id, status, work_order_id, scheduled_date, scheduled_time")
      .in("work_order_id", workOrderIds);
    jobInfoMap = Object.fromEntries(
      (woJobs ?? []).map((j: any) => [j.work_order_id, { status: j.status, scheduled_date: j.scheduled_date, scheduled_time: j.scheduled_time }])
    );
  }
  const workOrdersWithJobs = (workOrders ?? []).map((w: any) => ({
    ...w,
    job_status: jobInfoMap[w.id]?.status,
    job_scheduled_date: jobInfoMap[w.id]?.scheduled_date,
    job_scheduled_time: jobInfoMap[w.id]?.scheduled_time,
  }));

  return (
    <PortalDashboard
      propertyManager={pm}
      tenantName={(pm.tenants as any)?.name ?? "Your Contractor"}
      properties={properties ?? []}
      workOrders={workOrdersWithJobs as any[]}
      invoices={(invoices ?? []) as any[]}
      comments={(comments ?? []) as any[]}
      estimates={(estimates ?? []) as any[]}
      initialTab={(searchParams.tab as any) ?? "overview"}
      paidSuccess={searchParams.paid === "true"}
    />
  );
}
