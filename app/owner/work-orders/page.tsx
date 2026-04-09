import { requireOwner } from "@/lib/auth";
import { getOwnerWorkOrders } from "@/lib/services/owner";
import { formatDate, PRIORITY_CONFIG } from "@/lib/utils";
import Link from "next/link";

export default async function WorkOrdersPage() {
  const profile = await requireOwner();
  const workOrders = await getOwnerWorkOrders(profile);

  const pending   = workOrders?.filter((w) => w.status === "pending") || [];
  const accepted  = workOrders?.filter((w) => w.status === "accepted") || [];
  const declined  = workOrders?.filter((w) => w.status === "declined") || [];

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-800 text-3xl text-forge">Work Orders</h1>
          <p className="text-mist text-sm mt-1">{pending.length} pending review</p>
        </div>
      </div>

      {/* Pending - most important */}
      {pending.length > 0 && (
        <section aria-labelledby="pending-heading" className="mb-8">
          <h2 id="pending-heading" className="font-display font-700 text-xl text-forge mb-3 flex items-center gap-2">
            Pending Review
            <span className="w-6 h-6 bg-amber text-forge text-xs font-700 rounded-full flex items-center justify-center">
              {pending.length}
            </span>
          </h2>
          <div className="space-y-3">
            {pending.map((wo: any) => <WorkOrderCard key={wo.id} wo={wo} />)}
          </div>
        </section>
      )}

      {/* Accepted */}
      {accepted.length > 0 && (
        <section aria-labelledby="accepted-heading" className="mb-8">
          <h2 id="accepted-heading" className="font-display font-700 text-xl text-forge mb-3">Accepted</h2>
          <div className="space-y-3">
            {accepted.map((wo: any) => <WorkOrderCard key={wo.id} wo={wo} />)}
          </div>
        </section>
      )}

      {/* Declined */}
      {declined.length > 0 && (
        <section aria-labelledby="declined-heading" className="mb-8">
          <h2 id="declined-heading" className="font-display font-700 text-xl text-forge mb-3 text-mist">Declined</h2>
          <div className="space-y-3">
            {declined.map((wo: any) => <WorkOrderCard key={wo.id} wo={wo} />)}
          </div>
        </section>
      )}

      {!workOrders?.length && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-display font-700 text-xl text-forge mb-1">No work orders yet</p>
          <p className="text-mist text-sm">Work orders submitted by property managers will appear here.</p>
        </div>
      )}
    </div>
  );
}

function WorkOrderCard({ wo }: { wo: any }) {
  const priorityCfg = PRIORITY_CONFIG[wo.priority as keyof typeof PRIORITY_CONFIG];
  const statusColors: Record<string, string> = {
    pending:  "bg-yellow-100 text-yellow-700",
    accepted: "bg-green-100 text-green-700",
    declined: "bg-gray-100 text-gray-500",
  };

  return (
    <Link
      href={`/owner/work-orders/${wo.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all hover:border-amber/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-600 text-forge">{wo.title}</h3>
            <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
            <span className={`badge ${statusColors[wo.status]}`}>{wo.status}</span>
          </div>
          <p className="text-sm text-mist">
            {wo.property_managers?.full_name}
            {wo.property_managers?.company && ` · ${wo.property_managers.company}`}
            {" · "}{wo.properties?.name}
          </p>
          <p className="text-xs text-mist mt-1">{formatDate(wo.created_at)}</p>
        </div>
        <span className="text-mist text-sm shrink-0">→</span>
      </div>
    </Link>
  );
}
// Force dynamic rendering to avoid static 404s when data/env missing at build time
export const dynamic = "force-dynamic";
