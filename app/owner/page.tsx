import { requireOwner } from "@/lib/auth";
import { getOwnerDashboardData } from "@/lib/services/owner";
import { formatCurrency, formatDate, JOB_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/utils";
import Link from "next/link";
import { Job, WorkOrder } from "@/types";

export default async function OwnerDashboard() {
  const profile = await requireOwner();
  const { jobs, workOrders, invoices, workers } = await getOwnerDashboardData(profile);

  const stats = {
    activeJobs: jobs?.filter((j) => ["scheduled", "in_progress"].includes(j.status)).length || 0,
    pendingOrders: workOrders?.length || 0,
    totalWorkers: workers?.length || 0,
    revenue: invoices?.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.total, 0) || 0,
    outstanding: invoices?.filter((i) => ["sent", "overdue"].includes(i.status)).reduce((sum, i) => sum + i.total, 0) || 0,
  };

  const recentJobs = (jobs || []).slice(0, 6);
  const pendingOrders = workOrders || [];

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-800 text-3xl text-forge">Dashboard</h1>
        <p className="text-mist mt-1">{formatDate(new Date())}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Jobs" value={stats.activeJobs} accent />
        <StatCard label="Pending Work Orders" value={stats.pendingOrders} urgent={stats.pendingOrders > 0} />
        <StatCard label="Active Workers" value={stats.totalWorkers} />
        <StatCard label="Revenue (Paid)" value={formatCurrency(stats.revenue)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Jobs */}
        <section aria-labelledby="recent-jobs-heading" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 id="recent-jobs-heading" className="font-display font-700 text-xl text-forge">Recent Jobs</h2>
            <Link href="/owner/jobs" className="text-sm text-amber hover:underline font-500">View all →</Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {recentJobs.length === 0 ? (
              <div className="p-8 text-center text-mist text-sm">
                No jobs yet.{" "}
                <Link href="/owner/jobs/new" className="text-amber hover:underline">Create your first job →</Link>
              </div>
            ) : (
              recentJobs.map((job: Job) => {
                const statusCfg = JOB_STATUS_CONFIG[job.status];
                const priorityCfg = PRIORITY_CONFIG[job.priority];
                return (
                  <Link
                    key={job.id}
                    href={`/owner/jobs/${job.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="min-w-0">
                      <p className="font-500 text-sm text-forge truncate group-hover:text-amber transition-colors">{job.title}</p>
                      <p className="text-xs text-mist mt-0.5">
                        {job.scheduled_date ? formatDate(job.scheduled_date) : "Not scheduled"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                      <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        {/* Pending Work Orders */}
        <section aria-labelledby="work-orders-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="work-orders-heading" className="font-display font-700 text-xl text-forge">
              Work Orders
              {stats.pendingOrders > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-amber text-forge text-xs font-700 rounded-full">
                  {stats.pendingOrders}
                </span>
              )}
            </h2>
            <Link href="/owner/work-orders" className="text-sm text-amber hover:underline font-500">View all →</Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {pendingOrders.length === 0 ? (
              <div className="p-6 text-center text-mist text-sm">No pending work orders</div>
            ) : (
              pendingOrders.map((wo: any) => {
                const priorityCfg = PRIORITY_CONFIG[wo.priority as keyof typeof PRIORITY_CONFIG];
                return (
                  <Link
                    key={wo.id}
                    href={`/owner/work-orders/${wo.id}`}
                    className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-500 text-sm text-forge line-clamp-1">{wo.title}</p>
                      <span className={`badge shrink-0 ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                    </div>
                    <p className="text-xs text-mist mt-1">{wo.property_managers?.full_name} · {wo.properties?.name}</p>
                    <p className="text-xs text-mist mt-0.5">{formatDate(wo.created_at)}</p>
                  </Link>
                );
              })
            )}
          </div>

          {/* Outstanding invoices */}
          {stats.outstanding > 0 && (
            <div className="mt-4 bg-amber/10 border border-amber/30 rounded-xl p-4">
              <p className="font-display font-700 text-sm text-forge">Outstanding Invoices</p>
              <p className="font-display font-800 text-2xl text-amber-dark mt-1">{formatCurrency(stats.outstanding)}</p>
              <Link href="/owner/invoices?status=sent" className="text-xs text-amber hover:underline mt-1 inline-block">
                View unpaid →
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, urgent }: { label: string; value: string | number; accent?: boolean; urgent?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${urgent ? "border-amber" : "border-gray-200"}`}>
      <p className="text-xs text-mist uppercase tracking-wider font-600">{label}</p>
      <p className={`font-display font-800 text-2xl mt-1 ${accent ? "text-amber-dark" : "text-forge"}`}>{value}</p>
    </div>
  );
}
