import { createServiceClient } from "@/lib/supabase";
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

  const { data: pm } = await supabase
    .from("property_managers")
    .select("*, tenants(name)")
    .eq("portal_token", searchParams.token)
    .single();

  if (!pm) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white rounded-2xl border border-gray-200 p-8">
          <p className="text-4xl mb-3">🔒</p>
          <h1 className="font-display font-800 text-xl text-forge mb-2">Portal link invalid</h1>
          <p className="text-mist text-sm">This link may be expired. Contact your contractor for a new portal link.</p>
        </div>
      </div>
    );
  }

  const [
    { data: properties },
    { data: workOrders },
    { data: invoices },
    { data: comments },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, address, city, state")
      .eq("property_manager_id", pm.id)
      .order("name"),

    supabase
      .from("work_orders")
      .select("id, title, status, priority, created_at, properties(name)")
      .eq("property_manager_id", pm.id)
      .order("created_at", { ascending: false }),

    supabase
      .from("invoices")
      .select("id, invoice_number, status, total, due_date, created_at, jobs(title)")
      .eq("property_manager_id", pm.id)
      .order("created_at", { ascending: false }),

    supabase
      .from("work_order_comments")
      .select("id, work_order_id, message, created_at, property_managers(full_name)")
      .eq("tenant_id", pm.tenant_id)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <PortalDashboard
      token={searchParams.token}
      propertyManager={pm}
      tenantName={(pm.tenants as any)?.name ?? "Your Contractor"}
      properties={properties ?? []}
      workOrders={(workOrders ?? []) as any[]}
      invoices={(invoices ?? []) as any[]}
      comments={(comments ?? []) as any[]}
      initialTab={(searchParams.tab as any) ?? "overview"}
      paidSuccess={searchParams.paid === "true"}
    />
  );
}
