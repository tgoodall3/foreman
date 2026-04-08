import { requireOwner } from "@/lib/auth";
import { getOwnerJobs } from "@/lib/services/owner";
import { formatDate, JOB_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/utils";
import Link from "next/link";
import { Job } from "@/types";

export default async function JobsPage({ searchParams }: { searchParams: { status?: string; page?: string } }) {
  const profile = await requireOwner();
  const page = Math.max(1, Number(searchParams.page || "1"));
  const status = searchParams.status;
  const { jobs, count, pageSize } = await getOwnerJobs(profile, status, page);

  const pageCount = Math.ceil(count / pageSize);

  const statuses = Object.keys(JOB_STATUS_CONFIG) as (keyof typeof JOB_STATUS_CONFIG)[];

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-800 text-3xl text-forge">Jobs</h1>
          <p className="text-mist text-sm mt-1">{jobs?.length || 0} total</p>
        </div>
        <Link
          href="/owner/jobs/new"
          className="bg-amber hover:bg-amber-dark text-forge font-display font-700 px-4 py-2.5 rounded-lg text-sm transition-colors min-h-[44px] flex items-center"
        >
          + New Job
        </Link>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap mb-6" role="group" aria-label="Filter jobs by status">
        <Link
          href="/owner/jobs"
          className={`px-3 py-1.5 rounded-full text-xs font-600 border transition-colors ${!searchParams.status ? "bg-forge text-white border-forge" : "border-gray-300 text-mist hover:border-forge"}`}
        >
          All
        </Link>
        {statuses.map((s) => {
          const cfg = JOB_STATUS_CONFIG[s];
          return (
            <Link
              key={s}
              href={`/owner/jobs?status=${s}`}
              className={`px-3 py-1.5 rounded-full text-xs font-600 border transition-colors ${searchParams.status === s ? `${cfg.bg} ${cfg.color} border-current` : "border-gray-300 text-mist hover:border-gray-400"}`}
            >
              {cfg.label}
            </Link>
          );
        })}
      </div>

      {/* Jobs table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!jobs?.length ? (
          <div className="p-12 text-center">
            <p className="text-mist text-sm mb-3">No jobs found</p>
            <Link href="/owner/jobs/new" className="text-amber hover:underline text-sm">Create a job →</Link>
          </div>
        ) : (
          <>
            <table className="w-full text-sm" role="grid" aria-label="Jobs list">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Job</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Property</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Scheduled</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Priority</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((job: any) => {
                  const statusCfg = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
                  const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];
                  return (
                    <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/owner/jobs/${job.id}`} className="font-500 text-forge hover:text-amber transition-colors">
                          {job.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-mist">{job.properties?.name || "—"}</td>
                      <td className="px-4 py-3 text-mist">{job.scheduled_date ? formatDate(job.scheduled_date) : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pageCount > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <Link
                  href={`/owner/jobs?status=${status || ""}&page=${Math.max(1, page - 1)}`}
                  className={`text-sm font-semibold ${page === 1 ? "text-gray-400 pointer-events-none" : "text-forge hover:text-amber"}`}
                >
                  ← Previous
                </Link>
                <p className="text-xs text-mist">
                  Page {page} of {pageCount}
                </p>
                <Link
                  href={`/owner/jobs?status=${status || ""}&page=${Math.min(pageCount, page + 1)}`}
                  className={`text-sm font-semibold ${page === pageCount ? "text-gray-400 pointer-events-none" : "text-forge hover:text-amber"}`}
                >
                  Next →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
