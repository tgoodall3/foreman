import { requireOwner } from "@/lib/auth";
import { getOwnerJobs } from "@/lib/services/owner";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate, JOB_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/utils";
import Link from "next/link";

const ARCHIVE_DAYS = 14;

function biweeklyLabel(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString("en-US", { month: "long", year: "numeric" });
  const day = d.getDate();
  return day <= 14 ? `${month} (1–14)` : `${month} (15–31)`;
}

function groupByBiweekly<T extends { updated_at?: string; created_at: string }>(items: T[]) {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const label = biweeklyLabel(item.updated_at ?? item.created_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }
  return groups;
}

export default async function JobsPage({ searchParams }: { searchParams: { status?: string; page?: string; past?: string } }) {
  const profile  = await requireOwner();
  const showPast = searchParams.past === "1";
  const page     = Math.max(1, Number(searchParams.page || "1"));
  const status   = searchParams.status;

  const now = Date.now();
  const ageDays = (iso: string) => (now - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);

  let activeJobs: any[] = [];
  let archivedJobs: any[] = [];
  let count = 0;
  let pageSize = 25;
  let pageCount = 1;

  if (showPast) {
    // Fetch all completed jobs older than cutoff for archive view
    const supabase = await createServerSideClient();
    const cutoff = new Date(Date.now() - ARCHIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("jobs")
      .select("id, title, status, priority, scheduled_date, updated_at, created_at, invoice_id, properties(name)")
      .eq("tenant_id", profile.tenant_id)
      .in("status", ["completed", "cancelled", "invoiced"])
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: false });
    archivedJobs = data ?? [];
  } else {
    const result = await getOwnerJobs(profile, status, page);
    count    = result.count;
    pageSize = result.pageSize;
    pageCount = Math.ceil(count / pageSize);
    // Split: exclude completed older than cutoff from active view
    activeJobs  = result.jobs.filter((j: any) => !(["completed","cancelled","invoiced"].includes(j.status) && ageDays(j.updated_at ?? j.created_at) > ARCHIVE_DAYS));
    archivedJobs = result.jobs.filter((j: any) => ["completed","cancelled","invoiced"].includes(j.status) && ageDays(j.updated_at ?? j.created_at) > ARCHIVE_DAYS);
    count = activeJobs.length;
  }

  const archivedGroups = groupByBiweekly(archivedJobs);
  const statuses = Object.keys(JOB_STATUS_CONFIG) as (keyof typeof JOB_STATUS_CONFIG)[];
  const showInvoiceCta = status === "completed";

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-800 text-3xl text-forge">Jobs</h1>
          <p className="text-mist text-sm mt-1">{count} total</p>
        </div>
        <Link
          href="/owner/jobs/new"
          className="bg-amber hover:bg-amber-dark text-forge font-display font-700 px-4 py-2.5 rounded-lg text-sm transition-colors min-h-[44px] flex items-center"
        >
          + New Job
        </Link>
      </div>

      {/* Active / Past toggle */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/owner/jobs" className={`px-4 py-1.5 rounded-full text-sm font-600 transition-colors ${!showPast ? "bg-forge text-white" : "text-mist hover:text-forge"}`}>
          Active
        </Link>
        <Link href="/owner/jobs?past=1" className={`px-4 py-1.5 rounded-full text-sm font-600 transition-colors ${showPast ? "bg-forge text-white" : "text-mist hover:text-forge"}`}>
          Past {archivedJobs.length > 0 && <span className="ml-1 text-xs opacity-60">{archivedJobs.length}</span>}
        </Link>
      </div>

      {/* Past view */}
      {showPast && (
        <div className="space-y-6">
          {Object.keys(archivedGroups).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-mist text-sm">No past jobs yet</p>
            </div>
          ) : (
            Object.entries(archivedGroups).map(([label, items]) => (
              <div key={label}>
                <p className="text-xs font-700 uppercase tracking-widest text-mist mb-2 px-1">{label}</p>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {items.map((job: any) => {
                    const statusCfg = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
                    return (
                      <div key={job.id} className="flex items-center justify-between px-4 py-3 gap-3">
                        <div className="min-w-0">
                          <Link href={`/owner/jobs/${job.id}`} className="font-600 text-forge hover:text-amber text-sm">{job.title}</Link>
                          <p className="text-xs text-mist mt-0.5">{(job.properties as any)?.name ?? "—"} · {formatDate(job.updated_at ?? job.created_at)}</p>
                        </div>
                        <span className={`badge shrink-0 ${statusCfg?.bg ?? "bg-gray-100"} ${statusCfg?.color ?? "text-gray-600"}`}>{statusCfg?.label ?? job.status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showPast && <div />}

      {/* Active view */}
      {!showPast && <>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap mb-6" role="group" aria-label="Filter jobs by status">
        <Link
          href="/owner/jobs"
          className={`px-3 py-1.5 rounded-full text-xs font-600 border transition-colors ${
            !status ? "bg-forge text-white border-forge" : "border-gray-300 text-mist hover:border-forge"
          }`}
        >
          All
        </Link>
        {statuses.map((s) => {
          const cfg = JOB_STATUS_CONFIG[s];
          return (
            <Link
              key={s}
              href={`/owner/jobs?status=${s}`}
              className={`px-3 py-1.5 rounded-full text-xs font-600 border transition-colors ${
                status === s
                  ? `${cfg.bg} ${cfg.color} border-current`
                  : "border-gray-300 text-mist hover:border-gray-400"
              }`}
            >
              {cfg.label}
            </Link>
          );
        })}
      </div>

      {/* Uninvoiced callout when filtering completed */}
      {showInvoiceCta && (() => {
        const uninvoiced = (activeJobs as any[]).filter((j) => !j.invoice_id);
        return uninvoiced.length > 0 ? (
          <div className="mb-4 bg-amber/10 border border-amber/30 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm font-600 text-forge">
              {uninvoiced.length} job{uninvoiced.length !== 1 ? "s" : ""} completed — click <strong>Invoice →</strong> on any row to bill it
            </p>
          </div>
        ) : null;
      })()}

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!activeJobs?.length ? (
          <div className="p-12 text-center">
            <p className="text-mist text-sm mb-3">No jobs found</p>
            <Link href="/owner/jobs/new" className="text-amber hover:underline text-sm">
              Create a job →
            </Link>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 md:hidden">
              {(activeJobs as any[]).map((job) => {
                const statusCfg   = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
                const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];
                const needsInvoice = job.status === "completed" && !job.invoice_id;
                return (
                  <Link
                    key={job.id}
                    href={`/owner/jobs/${job.id}`}
                    className={`block p-4 space-y-2 ${needsInvoice ? "bg-amber/5" : "bg-white"} hover:bg-gray-50 transition-colors`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-700 text-forge">{job.title}</p>
                        <p className="text-xs text-mist mt-0.5">{job.properties?.name || "—"}</p>
                        {job.scheduled_date && (
                          <p className="text-xs text-mist mt-0.5">{formatDate(job.scheduled_date)}</p>
                        )}
                        <span className={`badge mt-1 ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                      </div>
                      <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                    </div>
                    {showInvoiceCta && needsInvoice && (
                      <Link
                        href={`/owner/invoices/new?job=${job.id}`}
                        className="inline-flex items-center gap-1 bg-amber hover:bg-amber-dark text-forge font-display font-700 px-3 py-1.5 rounded-lg text-xs transition-colors"
                      >
                        Invoice →
                      </Link>
                    )}
                    {showInvoiceCta && job.invoice_id && (
                      <span className="inline-flex items-center gap-1 text-xs font-700 text-forge px-3 py-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors">
                        View invoice
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            <div className="hidden md:block">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm" role="grid" aria-label="Jobs list">
                  <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Job</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Property</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Scheduled</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Status</th>
                  {showInvoiceCta && (
                    <th scope="col" className="px-4 py-3" aria-label="Invoice action" />
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(activeJobs as any[]).map((job) => {
                  const statusCfg   = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
                  const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];
                  const needsInvoice = job.status === "completed" && !job.invoice_id;

                  return (
                    <tr
                      key={job.id}
                      className={`hover:bg-gray-50 transition-colors ${needsInvoice ? "bg-amber/5" : ""}`}
                    >
                      <td className="px-4 py-3">
                  <Link
                    href={`/owner/jobs/${job.id}`}
                    className="block w-full font-600 text-forge hover:text-amber transition-colors"
                  >
                    {job.title}
                  </Link>
                        <span className={`ml-2 badge ${priorityCfg.bg} ${priorityCfg.color} hidden sm:inline`}>
                          {priorityCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-mist">
                        {job.properties?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-mist">
                        {job.scheduled_date ? formatDate(job.scheduled_date) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                      </td>
                      {showInvoiceCta && (
                        <td className="px-4 py-3 text-right">
                          {needsInvoice ? (
                            <Link
                              href={`/owner/invoices/new?job=${job.id}`}
                              className="inline-flex items-center gap-1 bg-amber hover:bg-amber-dark text-forge font-display font-700 px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap"
                            >
                              Invoice →
                            </Link>
                          ) : job.invoice_id ? (
                            <Link
                              href={`/owner/invoices/${job.invoice_id}`}
                              className="text-xs text-mist hover:text-amber transition-colors"
                            >
                              View invoice
                            </Link>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
                </table>
              </div>
            </div>

            {pageCount > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
                <Link
                  href={`/owner/jobs?${status ? `status=${status}&` : ""}page=${Math.max(1, page - 1)}`}
                  className={`text-sm font-600 ${page === 1 ? "text-gray-400 pointer-events-none" : "text-forge hover:text-amber"}`}
                >
                  ← Previous
                </Link>
                <p className="text-xs text-mist">Page {page} of {pageCount}</p>
                <Link
                  href={`/owner/jobs?${status ? `status=${status}&` : ""}page=${Math.min(pageCount, page + 1)}`}
                  className={`text-sm font-600 ${page === pageCount ? "text-gray-400 pointer-events-none" : "text-forge hover:text-amber"}`}
                >
                  Next →
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      </>}
    </div>
  );
}
