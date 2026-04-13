import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate, PRIORITY_CONFIG } from "@/lib/utils";
import WorkOrderActions from "./WorkOrderActions";
import MessagePM from "@/components/owner/MessagePM";

export const dynamic = "force-dynamic";

export default async function WorkOrderDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: wo, error } = await supabase
    .from("work_orders")
    .select("id, title, description, status, priority, created_at, tenant_id, property_id, property_managers(full_name, email, company, phone), properties(id, name, address, city, state), jobs(id, title, status)")
    .eq("id", params.id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  // If the record isn't found, render a friendly message instead of 404
  if (!wo) {
    const reason = "not found in database";
    return (
      <div className="p-6 max-w-3xl">
        <h1 className="font-display font-800 text-2xl text-forge mb-2">Work Order Unavailable</h1>
        <p className="text-mist text-sm mb-2">ID: {params.id}</p>
        <p className="text-mist text-sm">Reason: {reason}.</p>
        {process.env.NODE_ENV !== "production" && (
          <pre className="mt-3 bg-gray-100 border border-gray-200 rounded-lg p-3 text-xs text-steel">
            {JSON.stringify({ error }, null, 2)}
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
    <div className="px-3 py-5 sm:p-6 max-w-4xl w-full">
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1 text-[11px] text-mist">
            <Link href="/owner/work-orders" className="text-mist hover:text-forge underline underline-offset-2 decoration-black">Work Orders</Link>
            <span className="text-mist">/</span>
            <span className="text-forge truncate">{wo.title}</span>
          </div>
          <div className="space-y-2">
            <h1 className="font-display font-800 text-2xl sm:text-3xl text-forge leading-tight break-words">{wo.title}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
              <span className={`badge ${statusColors[wo.status] ?? "bg-gray-100 text-gray-600"}`}>{wo.status}</span>
              <span className="text-xs text-mist">Opened {formatDate(wo.created_at.split("T")[0])}</span>
            </div>
          </div>
        </div>
        <div className="flex w-full sm:w-auto items-stretch sm:items-center gap-2 sm:gap-3">
          {job && (
            <Link
              href={`/owner/jobs/${job.id}`}
              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1 bg-amber text-forge font-700 text-xs sm:text-sm px-3 py-2 rounded-lg hover:bg-amber-dark transition-colors"
            >
              Open Job →
            </Link>
          )}
          <Link
            href="/owner/jobs/new"
            className="inline-flex flex-1 sm:flex-none items-center justify-center text-xs sm:text-sm text-forge font-700 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
          >
            + New Job
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
        <div className="md:col-span-2 space-y-4">
          <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <h2 className="font-display font-700 text-lg text-forge mb-2">Description</h2>
            <p className="text-sm text-steel leading-relaxed">{wo.description || "No description provided."}</p>
          </section>
          {job && (
            <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
              <h2 className="font-display font-700 text-lg text-forge mb-2">Linked Job</h2>
              <Link href={`/owner/jobs/${job.id}`} className="text-sm text-forge underline underline-offset-2 decoration-black font-600">
                {job.title} ({job.status})
              </Link>
            </section>
          )}
        </div>

        <div className="space-y-4">
          {wo.status === "pending" && (
            <WorkOrderActions
              workOrderId={wo.id}
              tenantId={wo.tenant_id}
              workOrderTitle={wo.title}
              workOrderDescription={wo.description || ""}
              propertyId={prop?.id || (wo as any).property_id || ""}
            />
          )}
          {wo.status === "accepted" && job && (
            <div className="bg-white rounded-xl border border-green-200 p-4">
              <p className="text-sm text-green-700 font-600 mb-2">Job created from this work order.</p>
              <Link
                href={`/owner/jobs/${job.id}/edit`}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs font-700 px-3 py-2 rounded-lg transition-colors"
              >
                Schedule / Assign →
              </Link>
            </div>
          )}
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
                <MessagePM workOrderId={wo.id} pmName={pm.full_name} />
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
