import { createServiceClient } from "@/lib/supabase";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WorkOrdersDebugPage() {
  const profile = await requireOwner();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("work_orders")
    .select("id, tenant_id, title, status, priority, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="font-display font-800 text-2xl text-forge mb-3">Work Orders Debug</h1>
      <p className="text-xs text-mist mb-4">
        Showing all work_orders visible to service client. Your tenant_id: {profile.tenant_id}
      </p>
      {error && (
        <p className="text-sm text-red-600">Error: {String(error.message || error)}</p>
      )}
      {!data?.length ? (
        <p className="text-sm text-mist">No work orders returned.</p>
      ) : (
        <div className="space-y-2">
          {data.map((wo: any) => (
            <div key={wo.id} className="border border-gray-200 rounded-lg px-3 py-2">
              <p className="text-sm font-700 text-forge">{wo.title}</p>
              <p className="text-xs text-mist">ID: {wo.id}</p>
              <p className="text-xs text-mist">Tenant: {wo.tenant_id}</p>
              <p className="text-xs text-mist">Status: {wo.status} · Priority: {wo.priority}</p>
              <p className="text-xs text-mist">Created: {wo.created_at}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
