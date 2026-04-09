import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";
import { formatDate, PRIORITY_CONFIG } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WorkOrderDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireOwner();
  // Use service role to avoid RLS issues if session cookies fail on prod
  const supabase = createServiceClient();

  const { data: wo, error } = await supabase
    .from("work_orders")
    .select("id, title, description, status, priority, created_at, tenant_id, property_managers(full_name, email, company, phone), properties(name, address, city, state), jobs(id, title, status)")
    .eq("id", params.id)
    .maybeSingle();

  // If the record isn't found or tenant mismatched, render a friendly message instead of 404
  if (!wo || wo.tenant_id !== profile.tenant_id) {
    const reason = !wo ? "not found in database" : "belongs to a different tenant";
    return (
      <div className="p-6 max-w-3xl">
        <h1 className="font-display font-800 text-2xl text-forge mb-2">Work Order Unavailable</h1>
        <p className="text-mist text-sm mb-2">ID: {params.id}</p>
        <p className="text-mist text-sm">Reason: {reason}.</p>
        {process.env.NODE_ENV !== "production" && (
          <pre className="mt-3 bg-gray-100 border border-gray-200 rounded-lg p-3 text-xs text-steel">
            {JSON.stringify({ error, woTenant: wo?.tenant_id, userTenant: profile.tenant_id }, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  const priorityCfg = PRIORITY_CONFIG[wo.priority as keyof typeof PRIORITY_CONFIG];
  const statusColors: Record<string, string> = {
    pending:  "bg-yellow-100 text-yellow-700",
    accepted: "bg-green-100 text-green-700",
    declined: "bg-gray-100 text-gray-500",
  };

  const pm = Array.isArray(wo.property_managers) ? wo.property_managers[0] : (wo as any).property_managers;
  const prop = Array.isArray(wo.properties) ? wo.properties[0] : (wo as any).properties;
  const job = Array.isArray(wo.jobs) ? wo.jobs[0] : (wo as any).jobs;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/owner/work-orders" className="text-mist hover:text-forge text-sm transition-colors">Work Orders</Link>
            <span className="text-mist">/</span>
            <span className="text-sm text-forge">{wo.title}</span>
          </div>
          <h1 className="font-display font-800 text-3xl text-forge">{wo.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
            <span className={`badge ${statusColors[wo.status] ?? "bg-gray-100 text-gray-600"}`}>{wo.status}</span>
            <span className="text-xs text-mist">Opened {formatDate(wo.created_at.split("T")[0])}</span>
          </div>
        </div>
        <Link href="/owner/jobs/new" className="text-sm text-amber hover:underline font-600">+ New Job</Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-display font-700 text-lg text-forge mb-2">Description</h2>
            <p className="text-sm text-steel leading-relaxed">{wo.description || "No description provided."}</p>
          </section>
          {job && (
            <section className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-display font-700 text-lg text-forge mb-2">Linked Job</h2>
              <Link href={`/owner/jobs/${job.id}`} className="text-sm text-amber hover:underline font-600">
                {job.title} ({job.status})
              </Link>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-display font-700 text-base text-forge mb-2">Property</h3>
            {prop ? (
              <>
                <p className="text-sm font-600 text-forge">{prop.name}</p>
                <p className="text-xs text-mist">{prop.address}{prop.city ? `, ${prop.city}` : ""}{prop.state ? `, ${prop.state}` : ""}</p>
              </>
            ) : (
              <p className="text-sm text-mist">No property linked.</p>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-display font-700 text-base text-forge mb-2">Property Manager</h3>
            {pm ? (
              <>
                <p className="text-sm font-600 text-forge">{pm.full_name}</p>
                {pm.company && <p className="text-xs text-mist">{pm.company}</p>}
                {pm.email && <a className="text-xs text-amber hover:underline" href={`mailto:${pm.email}`}>{pm.email}</a>}
                {pm.phone && <p className="text-xs text-mist mt-1">{pm.phone}</p>}
              </>
            ) : (
              <p className="text-sm text-mist">No manager linked.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
