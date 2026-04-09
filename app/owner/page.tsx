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

  const { today, todayJobs, upcomingJobs, workOrders, workers, metrics, actions } =
    await getOwnerDashboardData(profile);

  const monthName  = new Date().toLocaleString("en-US", { month: "long" });
  const workerMap  = Object.fromEntries(workers.map((w: any) => [w.id, w.full_name]));

  const overdueCount = actions.overdueInvoices.length;
  const overdueTotal = actions.overdueInvoices.reduce((s: number, i: any) => s + (i.total ?? 0), 0);
  const unassignedToday = todayJobs.filter((j: any) => !j.assigned_workers || j.assigned_workers.length === 0).length;

  const { count: clockedInCount } = await supabase
    .from("time_entries")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id)
    .is("clocked_out_at", null);

  const actionCount =
    overdueCount +
    actions.uninvoicedJobs.length +
    actions.draftInvoices.length +
    actions.pendingOrders.length;

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display font-800 text-3xl text-forge">Today</h1>
          <p className="text-mist mt-0.5">{formatDate(today)}</p>
        </div>
        <Link
          href="/owner/jobs/new"
          className="bg-amber hover:bg-amber-dark text-forge font-display font-700 px-4 py-2 rounded-xl text-sm transition-colors"
        >
          + New Job
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StripCard label="Jobs today" value={todayJobs.length} tone="forge" />
        <StripCard label="Unassigned today" value={unassignedToday} tone={unassignedToday > 0 ? "amber" : "steel"} />
        <StripCard label="Workers clocked in" value={clockedInCount ?? 0} tone={(clockedInCount ?? 0) > 0 ? "green" : "steel"} />
        <StripCard label="Overdue invoices" value={overdueCount} tone={overdueCount > 0 ? "red" : "steel"} />
      </div>

      {/* ── Action-needed rail ─────────────────────────────────── */}
      {actionCount > 0 && (
        <section aria-label="Action needed" className="mb-6 space-y-2">
          {overdueCount > 0 && (
            <ActionBanner
              icon="⚠"
              color="red"
              message={`${overdueCount} overdue invoice${overdueCount !== 1 ? "s" : ""} — ${formatCurrency(overdueTotal)} outstanding`}
              href="/owner/invoices?status=overdue"
              linkLabel="Review →"
            />
          )}
          {actions.uninvoicedJobs.length > 0 && (
            <ActionBanner
              icon="💵"
              color="amber"
              message={`${actions.uninvoicedJobs.length} completed job${actions.uninvoicedJobs.length !== 1 ? "s" : ""} not yet invoiced`}
              href="/owner/jobs?status=completed"
              linkLabel="Invoice →"
            />
          )}
          {actions.draftInvoices.length > 0 && (
            <ActionBanner
              icon="📤"
              color="blue"
              message={`${actions.draftInvoices.length} draft invoice${actions.draftInvoices.length !== 1 ? "s" : ""} ready to send`}
              href="/owner/invoices?status=draft"
              linkLabel="Send →"
            />
          )}
          {actions.pendingOrders.length > 0 && (
            <ActionBanner
              icon="📋"
              color="gray"
              message={`${actions.pendingOrders.length} pending work order${actions.pendingOrders.length !== 1 ? "s" : ""} need attention`}
              href="/owner/work-orders"
              linkLabel="Review →"
            />
          )}
        </section>
      )}

      {/* ── Today's Jobs ──────────────────────────────────────── */}
      <section aria-labelledby="today-heading" className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 id="today-heading" className="font-display font-700 text-xl text-forge">
            {todayJobs.length > 0
              ? `${todayJobs.length} job${todayJobs.length !== 1 ? "s" : ""} today`
              : "No jobs scheduled today"}
          </h2>
          <Link href="/owner/schedule" className="text-sm text-amber hover:underline font-500">
            Schedule →
          </Link>
        </div>

        {todayJobs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-mist text-sm mb-3">Nothing on the books. Enjoy the quiet — or get ahead.</p>
            <Link href="/owner/jobs/new" className="text-amber hover:underline text-sm font-600">
              Schedule a job for today →
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {todayJobs.map((job: any) => {
              const statusCfg   = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
              const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];
              const prop = Array.isArray(job.properties) ? job.properties[0] : job.properties;
              const assignedNames: string[] = (job.assigned_workers ?? [])
                .map((id: string) => workerMap[id])
                .filter(Boolean);

              return (
                <Link
                  key={job.id}
                  href={`/owner/jobs/${job.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors group"
                >
                  {/* Time */}
                  <div className="w-14 shrink-0 text-right">
                    <p className="text-xs font-600 text-forge tabular-nums">
                      {job.scheduled_time
                        ? job.scheduled_time.slice(0, 5)
                        : <span className="text-mist">—</span>}
                    </p>
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-600 text-sm text-forge truncate group-hover:text-amber transition-colors">
                      {job.title}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      {prop?.name && (
                        <span className="text-xs text-mist">{prop.name}</span>
                      )}
                      {assignedNames.length > 0 && (
                        <>
                          {prop?.name && <span className="text-xs text-mist/40">·</span>}
                          {assignedNames.map((name) => (
                            <span key={name} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-gray-100 text-xs font-500 text-steel">
                              {name.split(" ")[0]}
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    {job.estimated_hours && (
                      <span className="text-xs text-mist tabular-nums hidden sm:inline">
                        {job.estimated_hours}h
                      </span>
                    )}
                    <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                    <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Bottom grid: stats + upcoming + work orders ───────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: stats + upcoming */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <section aria-label="Monthly metrics">
            <h2 className="font-display font-700 text-lg text-forge mb-3">{monthName}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Revenue"
                value={formatCurrency(metrics.revenueThisMonth)}
                accent
              />
              <StatCard
                label="Outstanding"
                value={formatCurrency(metrics.outstanding)}
                urgent={overdueCount > 0}
              />
              <StatCard
                label="Jobs Done"
                value={metrics.completedThisMonth}
                sub={metrics.avgJobHours != null ? `avg ${metrics.avgJobHours.toFixed(1)}h` : undefined}
              />
              <StatCard
                label="Workers"
                value={metrics.activeWorkers}
                sub="active"
              />
            </div>
          </section>

          {/* Upcoming */}
          {upcomingJobs.length > 0 && (
            <section aria-labelledby="upcoming-heading">
              <div className="flex items-center justify-between mb-3">
                <h2 id="upcoming-heading" className="font-display font-700 text-lg text-forge">Upcoming</h2>
                <Link href="/owner/schedule" className="text-sm text-amber hover:underline font-500">View schedule →</Link>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {upcomingJobs.map((job: any) => {
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
                })}
              </div>
            </section>
          )}
        </div>

        {/* Right: work orders + quick actions */}
        <div className="space-y-6">
          {/* Pending Work Orders */}
          <section aria-labelledby="work-orders-heading">
            <div className="flex items-center justify-between mb-3">
              <h2 id="work-orders-heading" className="font-display font-700 text-lg text-forge">
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
            <h2 id="quick-actions-heading" className="font-display font-700 text-lg text-forge mb-3">Quick Actions</h2>
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

function ActionBanner({
  icon,
  color,
  message,
  href,
  linkLabel,
}: {
  icon: string;
  color: "red" | "amber" | "blue" | "gray";
  message: string;
  href: string;
  linkLabel: string;
}) {
  const styles = {
    red:   "bg-red-50 border-red-200 text-red-700",
    amber: "bg-amber/10 border-amber/30 text-amber-dark",
    blue:  "bg-blue-50 border-blue-200 text-blue-700",
    gray:  "bg-gray-50 border-gray-200 text-steel",
  };
  return (
    <div className={`border rounded-xl px-4 py-2.5 flex items-center justify-between gap-4 ${styles[color]}`}>
      <div className="flex items-center gap-2">
        <span aria-hidden="true">{icon}</span>
        <p className="text-sm font-600">{message}</p>
      </div>
      <Link href={href} className="text-xs font-700 hover:underline shrink-0">
        {linkLabel}
      </Link>
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

function StripCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "forge" | "amber" | "green" | "red" | "steel";
}) {
  const styles = {
    forge: "bg-forge text-white",
    amber: "bg-amber text-forge",
    green: "bg-green-100 text-green-800",
    red:   "bg-red-100 text-red-700",
    steel: "bg-steel text-white",
  } as const;
  return (
    <div className={`rounded-xl px-4 py-3 border border-transparent ${styles[tone]}`}>
      <p className="text-[11px] uppercase tracking-wider font-700 opacity-80">{label}</p>
      <p className="font-display font-800 text-2xl">{value}</p>
    </div>
  );
}

