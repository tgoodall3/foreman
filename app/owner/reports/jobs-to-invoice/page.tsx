import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate, PRIORITY_CONFIG } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function JobsToInvoicePage() {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, priority, scheduled_date, updated_at, properties(name), work_orders(title)")
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "completed")
    .is("invoice_id", null)
    .order("updated_at", { ascending: false });

  return (
    <div className="p-6 max-w-5xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-mist font-700">Reports</p>
          <h1 className="font-display font-800 text-3xl text-forge leading-tight">Billing Gap</h1>
          <p className="text-mist text-sm mt-1">
            Completed jobs without an invoice. Convert these to recover revenue.
          </p>
        </div>
        <Link
          href="/owner/invoices/new"
          className="self-start bg-amber text-forge font-display font-700 px-4 py-2.5 rounded-lg text-sm shadow-sm hover:bg-amber-dark transition-colors whitespace-nowrap"
        >
          New Invoice
        </Link>
      </div>

      {!jobs?.length ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-mist text-sm">
          All completed jobs are invoiced. 🎉
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {/* Desktop table */}
          <table className="hidden sm:table w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">Job</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">Property</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">Completed</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">Priority</th>
                <th className="px-4 py-3 text-right text-xs font-700 text-mist uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((job: any) => {
                const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal;
                const prop = Array.isArray(job.properties) ? job.properties[0] : job.properties;
                const completed = job.updated_at ? formatDate(job.updated_at.split("T")[0]) : "—";
                return (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/owner/jobs/${job.id}`} className="text-forge font-600 hover:text-amber">
                        {job.title}
                      </Link>
                      {job.work_orders?.[0]?.title && (
                        <p className="text-xs text-mist mt-0.5 line-clamp-1">WO: {job.work_orders[0].title}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-steel">{prop?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-steel">{completed}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link href={`/owner/invoices/new?jobId=${job.id}`} className="text-xs font-700 text-amber hover:underline">
                        Invoice
                      </Link>
                      <Link href={`/owner/jobs/${job.id}`} className="text-xs font-700 text-forge hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {jobs.map((job: any) => {
              const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal;
              const prop = Array.isArray(job.properties) ? job.properties[0] : job.properties;
              const completed = job.updated_at ? formatDate(job.updated_at.split("T")[0]) : "—";
              return (
                <div key={job.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/owner/jobs/${job.id}`} className="text-forge font-600 hover:text-amber text-sm leading-snug">
                        {job.title}
                      </Link>
                      {prop?.name && <p className="text-xs text-mist mt-0.5">{prop.name}</p>}
                      <p className="text-xs text-steel mt-0.5">Completed {completed}</p>
                    </div>
                    <span className={`badge shrink-0 ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/owner/invoices/new?jobId=${job.id}`}
                      className="inline-flex items-center bg-amber text-forge text-xs font-700 px-3 py-1.5 rounded-lg hover:bg-amber-dark transition-colors"
                    >
                      Invoice
                    </Link>
                    <Link
                      href={`/owner/jobs/${job.id}`}
                      className="inline-flex items-center bg-white border border-gray-300 text-forge text-xs font-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
