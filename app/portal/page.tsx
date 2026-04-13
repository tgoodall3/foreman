import { createServiceClient } from "@/lib/supabase";
import { resolvePortalPmScope } from "@/lib/portal";
import PortalDashboard from "@/components/portal/PortalDashboard";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PortalPage({ searchParams }: { searchParams: { token?: string; tab?: string; paid?: string } }) {
  if (!searchParams.token) {
    return (
      <div className="min-h-screen bg-forge flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-amber rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="font-display font-800 text-forge text-2xl">F</span>
          </div>
          <h1 className="font-display font-800 text-white text-2xl mb-2">Foreman Portal</h1>
          <p className="text-mist text-sm">Please use the link provided by your contractor to access the portal.</p>
        </div>
      </div>
    );
  }

  const supabase = createServiceClient();

  const { pm, propertyManagerIds } = await resolvePortalPmScope(
    supabase,
    searchParams.token,
    "*, tenants(name)"
  );

  if (!pm) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white rounded-2xl border border-gray-200 p-8">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h1 className="font-display font-800 text-xl text-forge mb-2">Portal link invalid</h1>
          <p className="text-mist text-sm">This link may be expired. Contact your contractor for a new portal link.</p>
        </div>
      </div>
    );
  }

  if (pm.is_active === false) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white rounded-2xl border border-gray-200 p-8">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          </div>
          <h1 className="font-display font-800 text-xl text-forge mb-2">Portal access revoked</h1>
          <p className="text-mist text-sm">Your portal access has been deactivated. Contact your contractor to restore access.</p>
        </div>
      </div>
    );
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
      .select("id, estimate_number, status, total, title, created_at")
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

  // Stitch job statuses onto work orders so PMs can see progress/completion
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
      token={searchParams.token}
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
