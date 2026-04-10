import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { getOwnerDashboardData } from "@/lib/services/owner";
import { formatCurrency, formatDate, JOB_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/utils";
import WorkOrderInlineActions from "@/components/owner/WorkOrderInlineActions";
import MessagePM from "@/components/owner/MessagePM";
import QuickAssign from "@/components/owner/QuickAssign";

export default async function OwnerToday() {
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

  const { today, todayJobs, upcomingJobs, workOrders, workers, metrics, actions } =
    await getOwnerDashboardData(profile);

  const workerMap  = Object.fromEntries(workers.map((w: any) => [w.id, w.full_name]));
  const overdueCount = actions.overdueInvoices.length;
  const overdueTotal = actions.overdueInvoices.reduce((s: number, i: any) => s + (i.total ?? 0), 0);
  const unassignedToday = todayJobs.filter((j: any) => !j.assigned_workers || j.assigned_workers.length === 0).length;

  const { count: clockedInCount } = await supabase
    .from("time_entries")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id)
    .is("clocked_out_at", null);

  return (
    <div className="p-4 sm:p-6 lg:p-8 mx-auto w-full max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-mist font-700">Today</p>
          <h1 className="font-display font-800 text-3xl text-forge leading-tight">{formatDate(today)}</h1>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <Kpi label="Jobs today" value={todayJobs.length} tone="forge" />
          <Kpi label="Unassigned" value={unassignedToday} tone={unassignedToday ? "amber" : "steel"} />
          <Kpi label="Clocked in" value={clockedInCount ?? 0} tone={(clockedInCount ?? 0) ? "green" : "steel"} />
          <Kpi label="Overdue inv." value={overdueCount} tone={overdueCount ? "red" : "steel"} />
        </div>
      </div>

      {/* Action rail */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ActionCard
          title="Work Orders"
          count={actions.pendingOrders.length}
          body={actions.pendingOrders.length ? "Pending review" : "All caught up"}
          href="/owner/work-orders"
          cta="Review"
        />
        {actions.staleOrders.length > 0 && (
          <ActionCard
          title="Idle Work Orders"
          count={actions.staleOrders.length}
          body="Pending >24h"
          href="/owner/work-orders"
          cta="Follow up"
            tone="gray"
          />
        )}
        <ActionCard
          title="Time Requests"
          count={actions.pendingTimeRequests}
          body={actions.pendingTimeRequests ? "Awaiting approval" : "None"}
          href="/owner/timesheets"
          cta="Approve"
        />
        <ActionCard
          title="Overdue Invoices"
          count={overdueCount}
          body={overdueCount ? formatCurrency(overdueTotal) + " outstanding" : "None"}
          href="/owner/invoices?status=overdue"
          cta="Review"
          tone="red"
        />
        <ActionCard
          title="Ready to Bill"
          count={actions.uninvoicedJobs.length}
          body={actions.uninvoicedJobs.length ? "Completed jobs not invoiced" : "None"}
          href="/owner/reports/jobs-to-invoice"
          cta="Invoice"
          tone="amber"
        />
        <ActionCard
          title="Ready to Send"
          count={actions.draftInvoices.length}
          body={actions.draftInvoices.length ? "Draft invoices" : "None"}
          href="/owner/invoices?status=draft"
          cta="Send"
        />
        <ActionCard
          title="Recurring Health"
          count={0}
          body="Check overdue recurring jobs"
          href="/owner/reports/recurring-health"
          cta="Review"
        />
      </div>

      {/* Main grid */}
      <div className="grid gap-6">
        {/* Today’s jobs */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <p className="text-xs text-mist uppercase tracking-wide font-700">Jobs today</p>
              <p className="text-sm text-steel">{todayJobs.length > 0 ? `${todayJobs.length} scheduled` : "Nothing scheduled"}</p>
            </div>
            <Link href="/owner/schedule" className="text-xs font-700 text-amber hover:underline">Open schedule →</Link>
          </header>

          {todayJobs.length === 0 ? (
            <div className="p-6 text-center text-mist text-sm">Schedule a job for today to fill the board.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {todayJobs.map((job: any) => {
                const statusCfg   = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
                const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];
                const prop = Array.isArray(job.properties) ? job.properties[0] : job.properties;
                const isUnassigned = !job.assigned_workers || job.assigned_workers.length === 0;
                const assignedNames: string[] = (job.assigned_workers ?? [])
                  .map((id: string) => workerMap[id])
                  .filter(Boolean);

                return (
                  <div
                    key={job.id}
                    className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 rounded-lg ${
                      isUnassigned ? "bg-amber/5 border border-amber/40" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-[70px]">
                      <p className="text-xs font-700 text-forge tabular-nums">
                        {job.scheduled_time ? job.scheduled_time.slice(0, 5) : "—"}
                      </p>
                      <div className="flex flex-col min-w-0">
                        <Link href={`/owner/jobs/${job.id}`} className="font-600 text-sm text-forge hover:text-amber truncate">
                          {job.title}
                        </Link>
                        <div className="flex flex-wrap gap-1 mt-1 items-center">
                          {prop?.name && <span className="text-xs text-mist">{prop.name}</span>}
                          {isUnassigned && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber/30 text-[11px] font-700 text-forge">
                              Unassigned
                            </span>
                          )}
                          {assignedNames.map((name) => (
                            <span key={name} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-gray-100 text-xs font-500 text-steel">
                              {name.split(" ")[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:ml-auto sm:justify-end">
                      {job.estimated_hours && (
                        <span className="text-xs text-mist tabular-nums hidden sm:inline">{job.estimated_hours}h</span>
                      )}
                      <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                      <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                    </div>

                    <div className="sm:ml-4">
                      <QuickAssign
                        jobId={job.id}
                        scheduledDate={job.scheduled_date}
                        scheduledTime={job.scheduled_time}
                        assignedWorkers={job.assigned_workers}
                        workers={workers}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right column (stacked) */}
        <div className="space-y-4">
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <p className="text-xs text-mist uppercase tracking-wide font-700">Work Orders</p>
                <p className="text-sm text-steel">Pending</p>
              </div>
              <Link href="/owner/work-orders" className="text-xs font-700 text-amber hover:underline">View all →</Link>
            </header>
            <div className="divide-y divide-gray-100">
              {!workOrders?.length ? (
                <div className="p-6 text-center text-mist text-sm">No pending work orders.</div>
              ) : (
                workOrders.map((wo: any) => {
                  const priorityCfg = PRIORITY_CONFIG[wo.priority as keyof typeof PRIORITY_CONFIG];
                  const pm   = Array.isArray(wo.property_managers) ? wo.property_managers[0] : wo.property_managers;
                  const prop = Array.isArray(wo.properties) ? wo.properties[0] : wo.properties;
                  return (
                    <div key={wo.id} className="px-4 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/owner/work-orders/${wo.id}`} className="font-600 text-sm text-forge hover:text-amber line-clamp-1">
                          {wo.title}
                        </Link>
                        <span className={`badge shrink-0 ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                      </div>
                      <p className="text-xs text-mist line-clamp-1">
                        {pm?.full_name}{prop?.name ? ` · ${prop.name}` : ""}
                      </p>
                      <WorkOrderInlineActions
                        workOrderId={wo.id}
                        tenantId={profile.tenant_id}
                        title={wo.title}
                        description={wo.description || ""}
                        propertyId={prop?.id || wo.property_id || ""}
                      />
                      <MessagePM workOrderId={wo.id} pmName={pm?.full_name || "PM"} />
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
            <header className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs text-mist uppercase tracking-wide font-700">Quick Actions</p>
            </header>
            <div className="grid grid-cols-2 gap-2 p-3">
              {[{href:"/owner/jobs/new",label:"New Job"}, {href:"/owner/estimates/new",label:"New Estimate"}, {href:"/owner/invoices/new",label:"New Invoice"}, {href:"/owner/schedule",label:"Schedule"}].map((a) => (
                <Link key={a.href} href={a.href} className="flex items-center gap-2 bg-gray-50 border border-gray-200 hover:border-amber rounded-xl px-3 py-3 text-sm font-600 text-forge hover:text-amber transition-all">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber"></span>
                  {a.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Upcoming & metrics stacked for mobile */}
      <div className="grid gap-4">
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
          <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <p className="text-xs text-mist uppercase tracking-wide font-700">Upcoming</p>
              <p className="text-sm text-steel">Next 5 jobs</p>
            </div>
            <Link href="/owner/schedule" className="text-xs font-700 text-amber hover:underline">View schedule →</Link>
          </header>
          {upcomingJobs.length === 0 ? (
            <div className="p-6 text-center text-mist text-sm">No upcoming jobs.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {upcomingJobs.map((job: any) => {
                const statusCfg   = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
                const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];
                const prop = Array.isArray(job.properties) ? job.properties[0] : job.properties;
                return (
                  <Link key={job.id} href={`/owner/jobs/${job.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0">
                      <p className="font-500 text-sm text-forge truncate">{job.title}</p>
                      <p className="text-xs text-mist mt-0.5 line-clamp-1">
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
              })}
            </div>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-xs text-mist uppercase tracking-wide font-700">This month</p>
          <Metric label="Revenue" value={formatCurrency(metrics.revenueThisMonth)} accent />
          <Metric label="Outstanding" value={formatCurrency(metrics.outstanding)} urgent={overdueCount > 0} />
          <Metric label="Jobs done" value={metrics.completedThisMonth} sub={metrics.avgJobHours != null ? `avg ${metrics.avgJobHours.toFixed(1)}h` : undefined} />
          <Metric label="Workers" value={metrics.activeWorkers} sub="active" />
          <Metric label="Estimate win rate" value={`${metrics.estimateWinRate}%`} sub={`${metrics.estimateTotals} sent`} />
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number | string; tone: "forge" | "amber" | "green" | "red" | "steel"; }) {
  const styles = {
    forge: "bg-forge text-white",
    amber: "bg-amber text-forge",
    green: "bg-green-100 text-green-800",
    red:   "bg-red-100 text-red-700",
    steel: "bg-steel text-white",
  } as const;
  return (
    <div className={`rounded-xl px-3 py-2 border border-transparent text-left ${styles[tone]}`}>
      <p className="text-[11px] uppercase tracking-wider font-700 opacity-80">{label}</p>
      <p className="font-display font-800 text-xl leading-tight">{value}</p>
    </div>
  );
}

function ActionCard({ title, count, body, href, cta, tone = "gray" }: {
  title: string; count: number; body: string; href: string; cta: string; tone?: "gray" | "red" | "amber";
}) {
  const styles = {
    red:   { border: "border-red-200",   bg: "bg-red-50/80",   text: "text-red-800", cta: "bg-red-600 text-white hover:bg-red-700" },
    amber: { border: "border-amber/60",  bg: "bg-amber/20",    text: "text-amber-900", cta: "bg-amber text-forge hover:bg-amber-dark" },
    gray:  { border: "border-gray-200",  bg: "bg-white",       text: "text-forge", cta: "bg-amber/80 text-forge hover:bg-amber" },
  } as const;
  const style = styles[tone];
  return (
    <div className={`rounded-2xl border ${style.border} ${style.bg} shadow-sm p-4 flex items-center justify-between gap-3`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-700 text-forge">
          <span className="inline-block w-2 h-2 rounded-full bg-current opacity-60" aria-hidden />
          <span>{title}</span>
        </div>
        <p className={`text-xs mt-1 ${tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-900" : "text-mist"}`}>{body}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className={`px-2 py-1 rounded-lg text-xs font-700 ${style.text} bg-white/60 border border-black/5`}>{count}</span>
        <Link href={href} className={`text-xs font-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm ${style.cta}`}>
          {cta} →
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, accent, urgent }: { label: string; value: string | number; sub?: string; accent?: boolean; urgent?: boolean; }) {
  return (
    <div className={`rounded-xl border p-3 ${urgent ? "border-red-200 bg-red-50/30" : "border-gray-200"}`}>
      <p className="text-xs text-mist uppercase tracking-wider font-700 leading-tight">{label}</p>
      <p className={`font-display font-800 text-xl mt-1 ${accent ? "text-amber-dark" : urgent ? "text-red-600" : "text-forge"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-mist mt-0.5">{sub}</p>}
    </div>
  );
}
