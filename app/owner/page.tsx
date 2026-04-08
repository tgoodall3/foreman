import { requireOwner } from "@/lib/auth";
import { getOwnerDashboardData } from "@/lib/services/owner";
import { formatCurrency, formatDate, JOB_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSideClient } from "@/lib/supabase-server";

export default async function OwnerDashboard() {
  const profile  = await requireOwner();
  const supabase = await createServerSideClient();

  // Redirect brand-new tenants to onboarding
  const [{ count: workerCount }, { count: pmCount }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true })
      .eq("tenant_id", profile.tenant_id).eq("role", "worker"),
    supabase.from("property_managers").select("id", { count: "exact", head: true })
      .eq("tenant_id", profile.tenant_id),
  ]);
  if ((workerCount ?? 0) === 0 && (pmCount ?? 0) === 0) redirect("/owner/onboarding");

  const { jobs, workOrders, metrics } = await getOwnerDashboardData(profile);

  const today = new Date();
  const monthName = today.toLocaleString("en-US", { month: "long" });

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-800 text-3xl text-forge">Dashboard</h1>
        <p className="text-mist mt-1">{formatDate(today)}</p>
      </div>

      {/* Overdue alert */}
      {metrics.overdueCount > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-lg">⚠</span>
            <p className="text-sm font-600 text-red-700">
              {metrics.overdueCount} overdue invoice{metrics.overdueCount !== 1 ? "s" : ""} — {formatCurrency(metrics.overdueTotal)} outstanding
            </p>
          </div>
          <Link href="/owner/invoices?status=overdue" className="text-xs text-red-700 hover:underline font-600 shrink-0">
            View →
          </Link>
        </div>
      )}

      {/* Today's schedule callout */}
      {metrics.todayJobCount > 0 && (
        <div className="mb-6 bg-amber/10 border border-amber/30 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm font-600 text-forge">
            📅 {metrics.todayJobCount} job{metrics.todayJobCount !== 1 ? "s" : ""} scheduled today
          </p>
          <Link href="/owner/schedule" className="text-xs text-amber hover:underline font-600 shrink-0">
            View schedule →
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label={`Revenue (${monthName})`}
          value={formatCurrency(metrics.revenueThisMonth)}
          sub={`${formatCurrency(metrics.revenueAllTime)} all time`}
          accent
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(metrics.outstanding)}
          sub={metrics.overdueCount > 0 ? `${metrics.overdueCount} overdue` : "all current"}
          urgent={metrics.overdueCount > 0}
        />
        <StatCard
          label={`Completed (${monthName})`}
          value={metrics.completedThisMonth}
          sub={
            metrics.avgJobHours != null
              ? `avg ${metrics.avgJobHours.toFixed(1)}h per job`
              : "no time tracked"
          }
        />
        <StatCard
          label="Active Workers"
          value={metrics.activeWorkers}
          sub={metrics.pendingWorkOrders > 0 ? `${metrics.pendingWorkOrders} work orders pending` : "no pending orders"}
          urgent={metrics.pendingWorkOrders > 0}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Jobs */}
        <section aria-labelledby="recent-jobs-heading" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 id="recent-jobs-heading" className="font-display font-700 text-xl text-forge">Recent Jobs</h2>
            <div className="flex items-center gap-3">
              <Link href="/owner/schedule" className="text-sm text-mist hover:text-amber font-500 transition-colors">Schedule →</Link>
              <Link href="/owner/jobs" className="text-sm text-amber hover:underline font-500">All jobs →</Link>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {!jobs?.length ? (
              <div className="p-8 text-center text-mist text-sm">
                No jobs yet.{" "}
                <Link href="/owner/jobs/new" className="text-amber hover:underline">Create your first job →</Link>
              </div>
            ) : (
              jobs.map((job: any) => {
                const statusCfg   = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
                const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];
                const prop = Array.isArray(job.properties) ? job.properties[0] : job.properties;
                return (
                  <Link
                    key={job.id}
                    href={`/owner/jobs/${job.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="min-w-0">
                      <p className="font-500 text-sm text-forge truncate group-hover:text-amber transition-colors">{job.title}</p>
                      <p className="text-xs text-mist mt-0.5">
                        {prop?.name ? `${prop.name} · ` : ""}
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

        {/* Right column */}
        <div className="space-y-6">
          {/* Pending Work Orders */}
          <section aria-labelledby="work-orders-heading">
            <div className="flex items-center justify-between mb-4">
              <h2 id="work-orders-heading" className="font-display font-700 text-xl text-forge">
                Work Orders
                {metrics.pendingWorkOrders > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-amber text-forge text-xs font-700 rounded-full">
                    {metrics.pendingWorkOrders}
                  </span>
                )}
              </h2>
              <Link href="/owner/work-orders" className="text-sm text-amber hover:underline font-500">View all →</Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {!workOrders?.length ? (
                <div className="p-6 text-center text-mist text-sm">No pending work orders</div>
              ) : (
                workOrders.map((wo: any) => {
                  const priorityCfg = PRIORITY_CONFIG[wo.priority as keyof typeof PRIORITY_CONFIG];
                  const pm   = Array.isArray(wo.property_managers) ? wo.property_managers[0] : wo.property_managers;
                  const prop = Array.isArray(wo.properties) ? wo.properties[0] : wo.properties;
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
                      <p className="text-xs text-mist mt-1">
                        {pm?.full_name}{prop?.name ? ` · ${prop.name}` : ""}
                      </p>
                    </Link>
                  );
                })
              )}
            </div>
          </section>

          {/* Quick actions */}
          <section aria-labelledby="quick-actions-heading">
            <h2 id="quick-actions-heading" className="font-display font-700 text-xl text-forge mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/owner/jobs/new",      label: "New Job",      icon: "🔨" },
                { href: "/owner/estimates/new", label: "New Estimate", icon: "📝" },
                { href: "/owner/invoices/new",  label: "New Invoice",  icon: "💵" },
                { href: "/owner/schedule",      label: "Schedule",     icon: "📅" },
              ].map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex items-center gap-2 bg-white border border-gray-200 hover:border-amber rounded-xl px-3 py-3 text-sm font-600 text-forge hover:text-amber transition-all"
                >
                  <span aria-hidden="true">{a.icon}</span>
                  {a.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
  urgent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  urgent?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${urgent ? "border-red-200 bg-red-50/30" : "border-gray-200"}`}>
      <p className="text-xs text-mist uppercase tracking-wider font-600 leading-tight">{label}</p>
      <p className={`font-display font-800 text-2xl mt-1.5 ${accent ? "text-amber-dark" : urgent ? "text-red-600" : "text-forge"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-mist mt-1">{sub}</p>}
    </div>
  );
}
