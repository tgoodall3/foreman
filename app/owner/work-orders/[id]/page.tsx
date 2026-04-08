import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate, formatDateTime, PRIORITY_CONFIG } from "@/lib/utils";
import { notFound } from "next/navigation";
import WorkOrderActions from "./WorkOrderActions";

export default async function WorkOrderDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: wo } = await supabase
    .from("work_orders")
    .select("*, properties(name, address, city, state), property_managers(full_name, email, company, phone)")
    .eq("id", params.id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!wo) notFound();

  const priorityCfg = PRIORITY_CONFIG[wo.priority as keyof typeof PRIORITY_CONFIG];
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    accepted: "bg-green-100 text-green-700",
    declined: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="p-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <a href="/owner/work-orders" className="text-mist hover:text-forge transition-colors">Work Orders</a>
        <span className="text-mist">/</span>
        <span className="text-forge">{wo.title}</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display font-800 text-3xl text-forge">{wo.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
            <span className={`badge ${statusColors[wo.status]}`}>{wo.status}</span>
            <span className="text-xs text-mist">Submitted {formatDate(wo.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Description */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-display font-700 text-lg text-forge mb-3">Description</h2>
            <p className="text-sm text-steel leading-relaxed">{wo.description}</p>
          </section>

          {/* Photos */}
          {wo.photos?.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-display font-700 text-lg text-forge mb-3">Photos ({wo.photos.length})</h2>
              <div className="grid grid-cols-3 gap-3">
                {wo.photos.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" aria-label={`View photo ${i + 1}`}>
                    <img src={url} alt={`Work order photo ${i + 1}`} className="w-full h-28 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity" />
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Actions */}
          {wo.status === "pending" && (
            <WorkOrderActions workOrderId={wo.id} tenantId={profile.tenant_id} workOrderTitle={wo.title} workOrderDescription={wo.description} propertyId={wo.property_id} />
          )}

          {wo.status === "accepted" && wo.job_id && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="font-600 text-green-700 text-sm">✅ Converted to job</p>
              <a href={`/owner/jobs/${wo.job_id}`} className="text-sm text-green-600 hover:underline mt-1 inline-block">
                View job →
              </a>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Property */}
          {wo.properties && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-mist uppercase tracking-wider font-600 mb-2">Property</p>
              <p className="font-600 text-forge text-sm">{wo.properties.name}</p>
              <p className="text-xs text-mist mt-1">{wo.properties.address}</p>
              <p className="text-xs text-mist">{wo.properties.city}, {wo.properties.state}</p>
            </div>
          )}

          {/* Property Manager */}
          {wo.property_managers && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-mist uppercase tracking-wider font-600 mb-2">Submitted By</p>
              <p className="font-600 text-forge text-sm">{wo.property_managers.full_name}</p>
              {wo.property_managers.company && <p className="text-xs text-mist">{wo.property_managers.company}</p>}
              <a href={`mailto:${wo.property_managers.email}`} className="text-xs text-amber hover:underline block mt-1">{wo.property_managers.email}</a>
              {wo.property_managers.phone && <p className="text-xs text-mist mt-0.5">{wo.property_managers.phone}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
