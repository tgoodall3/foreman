import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { getOwnerDashboardData } from "@/lib/services/owner";
import { formatCurrency, formatDate, JOB_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/utils";
import WorkOrderInlineActions from "@/components/owner/WorkOrderInlineActions";
import MessagePM from "@/components/owner/MessagePM";
import QuickAssign from "@/components/owner/QuickAssign";
import { getServerT } from "@/lib/i18n/server";
import { Briefcase, FileText, Receipt, CalendarDays, ChevronRight, type LucideIcon } from "lucide-react";

const ROW_CARD_CLASS = "block rounded-xl border border-gray-200/80 px-3 py-3 transition-all hover:bg-gray-50 hover:shadow-sm";
const ROW_TITLE_CLASS = "line-clamp-1 text-sm font-700 text-forge";
const ROW_META_CLASS = "mt-1 line-clamp-1 text-xs text-mist";

export default async function OwnerToday() {
  const profile  = await requireOwner();
  const supabase = await createServerSideClient();
  const t = await getServerT();

  const [{ count: workerCount }, { count: pmCount }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true })
      .eq("tenant_id", profile.tenant_id).eq("role", "worker"),
    supabase.from("property_managers").select("id", { count: "exact", head: true })
      .eq("tenant_id", profile.tenant_id),
  ]);
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

  const quickActions: { href: string; label: string; icon: LucideIcon }[] = [
    { href: "/owner/jobs/new",       label: t("dashboard.newJob"),      icon: Briefcase   },
    { href: "/owner/estimates/new",  label: t("dashboard.newEstimate"), icon: FileText    },
    { href: "/owner/invoices/new",   label: t("dashboard.newInvoice"),  icon: Receipt     },
    { href: "/owner/schedule",       label: t("nav.schedule"),          icon: CalendarDays },
  ];

  return (
    <div className="page-shell page-shell-standard lg:p-8">

      {/* Hero header — dark card */}
      <div className="rounded-2xl bg-gradient-to-br from-forge to-forge-light px-4 py-5 sm:px-6 sm:py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-amber font-700">{t("dashboard.todayLabel")}</p>
          <h1 className="font-display font-800 text-3xl text-white leading-tight mt-0.5">{formatDate(today)}</h1>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <Kpi label={t("dashboard.jobsToday")}  value={todayJobs.length}       tone="neutral" />
          <Kpi label={t("dashboard.unassigned")} value={unassignedToday}         tone={unassignedToday ? "amber" : "neutral"} />
          <Kpi label={t("dashboard.clockedIn")}  value={clockedInCount ?? 0}     tone={(clockedInCount ?? 0) ? "green" : "neutral"} />
          <Kpi label={t("dashboard.overdueInv")} value={overdueCount}            tone={overdueCount ? "red" : "neutral"} />
        </div>
      </div>

      {/* Quick Actions */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <header className="px-4 py-3 sm:px-5 border-b border-gray-100">
          <h2 className="font-display font-700 text-base text-forge">{t("dashboard.quickActions")}</h2>
        </header>
        <div className="space-y-3 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {quickActions.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex min-h-[56px] items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-600 text-forge transition-all hover:border-amber hover:bg-white hover:shadow-sm"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber/15 text-amber transition-colors group-hover:bg-amber group-hover:text-forge">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </Link>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <ActionCard
              title={t("nav.workOrders")}
              count={actions.pendingOrders.length}
              body={actions.pendingOrders.length ? t("dashboard.pendingReview") : t("dashboard.allCaughtUp")}
              href="/owner/work-orders"
              cta={t("dashboard.reviewQueue")}
            />
            {actions.staleOrders.length > 0 && (
              <ActionCard
                title={t("dashboard.idleWorkOrders")}
                count={actions.staleOrders.length}
                body={t("dashboard.pendingMoreThan24h")}
                href="/owner/work-orders"
                cta={t("dashboard.followUp")}
              />
            )}
            <ActionCard
              title={t("dashboard.timeRequests")}
              count={actions.pendingTimeRequests}
              body={actions.pendingTimeRequests ? t("dashboard.awaitingApproval") : t("dashboard.nonePending")}
              href="/owner/timesheets"
              cta={t("dashboard.openApprovals")}
            />
          </div>
        </div>
      </section>

      {/* Jobs */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 sm:px-5 border-b border-gray-100">
          <div>
            <h2 className="font-display font-700 text-base text-forge">{t("nav.jobs")}</h2>
            <p className="text-xs text-mist mt-0.5">
              {todayJobs.length + upcomingJobs.length > 0
                ? `${todayJobs.length} today, ${upcomingJobs.length} next`
                : t("dashboard.nothingScheduled")}
            </p>
          </div>
          <Link href="/owner/schedule" className="inline-flex items-center gap-1.5 rounded-lg bg-forge px-3 py-1.5 text-xs font-700 text-white hover:bg-forge-light transition-colors">{t("dashboard.openSchedule")} →</Link>
        </header>

        <div className="divide-y divide-gray-100">
          <div>
            <div className="px-4 py-2 sm:px-5 bg-amber/5 border-b border-amber/10">
              <p className="text-[11px] text-amber-dark uppercase tracking-[0.18em] font-700">Today</p>
            </div>
            {todayJobs.length === 0 ? (
              <div className="p-6 text-center text-mist text-sm">{t("dashboard.scheduleTodayNote")}</div>
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
                    <div key={job.id} className={`mx-3 my-2 sm:mx-4 rounded-xl border transition-all hover:shadow-sm ${isUnassigned ? "border-amber/40 bg-amber/5" : "border-gray-200/80 bg-white"}`}>
                      <Link href={`/owner/jobs/${job.id}`} className="block px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1.5">
                            <p className={ROW_TITLE_CLASS}>{job.title}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              {prop?.name && <span className="text-xs text-mist">{prop.name}</span>}
                              {job.estimated_hours && (
                                <span className="text-xs text-mist tabular-nums">{job.estimated_hours}h planned</span>
                              )}
                              {isUnassigned && (
                                <span className="inline-flex items-center rounded-md bg-amber/30 px-1.5 py-0.5 text-[11px] font-700 text-forge">
                                  Unassigned
                                </span>
                              )}
                            </div>
                            {assignedNames.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {assignedNames.map((name) => (
                                  <span key={name} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-700 text-steel">
                                    {name.split(" ")[0]}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="ml-2 flex shrink-0 flex-wrap justify-end gap-2">
                            <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                            <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                          </div>
                        </div>
                      </Link>

                      <div className="border-t border-gray-100 px-3 py-2 flex justify-end">
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
          </div>

          <div>
            <div className="px-4 py-2 sm:px-5 bg-gray-50/80 border-b border-gray-100">
              <p className="text-[11px] text-mist uppercase tracking-[0.18em] font-700">Next</p>
            </div>
            {upcomingJobs.length === 0 ? (
              <div className="p-6 text-center text-mist text-sm">{t("dashboard.noUpcomingJobs")}</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {upcomingJobs.map((job: any) => {
                  const statusCfg   = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
                  const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];
                  const prop = Array.isArray(job.properties) ? job.properties[0] : job.properties;

                  return (
                    <div key={job.id} className="px-3 py-2 sm:px-4">
                      <Link
                        href={`/owner/jobs/${job.id}`}
                        className={`flex min-h-[72px] items-center justify-between gap-3 ${ROW_CARD_CLASS}`}
                      >
                        <div className="min-w-0">
                          <p className={ROW_TITLE_CLASS}>{job.title}</p>
                          <p className={ROW_META_CLASS}>
                            {prop?.name ? `${prop.name} · ` : ""}
                            {job.scheduled_date ? formatDate(job.scheduled_date) : "Not scheduled"}
                          </p>
                        </div>
                        <div className="ml-2 flex shrink-0 flex-wrap justify-end gap-2">
                          <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                          <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Work Orders */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 sm:px-5 border-b border-gray-100">
          <div>
            <h2 className="font-display font-700 text-base text-forge">{t("nav.workOrders")}</h2>
            <p className="text-xs text-mist mt-0.5">{t("workOrders.pendingTab")}</p>
          </div>
          <Link href="/owner/work-orders" className="inline-flex items-center gap-1.5 rounded-lg bg-forge px-3 py-1.5 text-xs font-700 text-white hover:bg-forge-light transition-colors">{t("common.open")} →</Link>
        </header>
        <div className="divide-y divide-gray-100">
          {!workOrders?.length ? (
            <div className="p-6 text-center text-mist text-sm">{t("workOrders.noWorkOrders")}</div>
          ) : (
            workOrders.map((wo: any) => {
              const priorityCfg = PRIORITY_CONFIG[wo.priority as keyof typeof PRIORITY_CONFIG];
              const pm   = Array.isArray(wo.property_managers) ? wo.property_managers[0] : wo.property_managers;
              const prop = Array.isArray(wo.properties) ? wo.properties[0] : wo.properties;

              return (
                <div key={wo.id} className="space-y-2 px-3 py-2 sm:px-4">
                  <Link href={`/owner/work-orders/${wo.id}`} className={ROW_CARD_CLASS}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={ROW_TITLE_CLASS}>{wo.title}</p>
                        <p className={ROW_META_CLASS}>{pm?.full_name}{prop?.name ? ` · ${prop.name}` : ""}</p>
                      </div>
                      <span className={`badge shrink-0 ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                    </div>
                  </Link>

                  <div className="space-y-2 px-1 sm:px-0">
                    <WorkOrderInlineActions
                      workOrderId={wo.id}
                      tenantId={profile.tenant_id}
                      title={wo.title}
                      description={wo.description || ""}
                      propertyId={prop?.id || wo.property_id || ""}
                    />
                    <MessagePM workOrderId={wo.id} pmName={pm?.full_name || "PM"} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Billing */}
      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <header className="px-4 py-3 sm:px-5 border-b border-gray-100">
          <h2 className="font-display font-700 text-base text-forge">{t("dashboard.billing")}</h2>
        </header>
        <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          <ActionCard
            title={t("dashboard.overdueInvoices")}
            count={overdueCount}
            body={overdueCount ? `${formatCurrency(overdueTotal)} ${t("dashboard.outstanding").toLowerCase()}` : t("common.none")}
            href="/owner/invoices?status=overdue"
            cta={t("dashboard.reviewBilling")}
            tone="red"
          />
          <ActionCard
            title={t("dashboard.readyToBill")}
            count={actions.uninvoicedJobs.length}
            body={actions.uninvoicedJobs.length ? t("dashboard.completedNotInvoiced") : t("common.none")}
            href="/owner/reports/jobs-to-invoice"
            cta={t("dashboard.createInvoices")}
            tone="amber"
          />
          <ActionCard
            title={t("dashboard.readyToSend")}
            count={actions.draftInvoices.length}
            body={actions.draftInvoices.length ? t("dashboard.draftInvoices") : t("common.none")}
            href="/owner/invoices?status=draft"
            cta={t("dashboard.sendDrafts")}
          />
        </div>
      </section>

      {/* Metrics — mobile collapsible */}
      <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm md:hidden [&_summary::-webkit-details-marker]:hidden">
        <summary className="list-none cursor-pointer px-3 py-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 transition-colors group-open:bg-white group-open:border-gray-300">
            <div className="min-w-0">
              <p className="text-xs text-mist uppercase tracking-wide font-700">{t("dashboard.metricsHealth")}</p>
              <p className="mt-1 text-sm text-steel">{t("dashboard.tapToExpand")}</p>
              <p className="mt-1 text-xs text-mist">
                {formatCurrency(metrics.revenueThisMonth)} revenue · {formatCurrency(metrics.outstanding)} outstanding
              </p>
            </div>
            <div className="flex shrink-0 items-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forge text-white shadow-sm transition-transform group-open:rotate-180">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </div>
          </div>
        </summary>
        <div className="border-t border-gray-100 p-3">
          <div className="mb-3 flex items-center justify-between rounded-lg bg-chalk px-3 py-2">
            <p className="text-[11px] font-700 uppercase tracking-[0.16em] text-steel">{t("dashboard.expandedMetrics")}</p>
            <span className="text-[11px] font-700 text-mist">{t("dashboard.tapToCollapse")}</span>
          </div>
          <MetricsHealthContent metrics={metrics} overdueCount={overdueCount} t={t} />
        </div>
      </details>

      {/* Metrics — desktop */}
      <section className="hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
        <header className="px-4 py-3 sm:px-5 border-b border-gray-100">
          <h2 className="font-display font-700 text-base text-forge">{t("dashboard.metricsHealth")}</h2>
        </header>
        <div className="p-4 sm:p-5">
          <MetricsHealthContent metrics={metrics} overdueCount={overdueCount} t={t} />
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: {
  label: string;
  value: number | string;
  tone: "neutral" | "amber" | "green" | "red";
}) {
  const styles = {
    neutral: "bg-white/10 text-white border-white/10",
    amber:   "bg-amber text-forge border-amber",
    green:   "bg-emerald-400/25 text-emerald-100 border-emerald-400/20",
    red:     "bg-red-400/25 text-red-100 border-red-400/20",
  } as const;
  return (
    <div className={`rounded-xl px-3 py-2.5 border ${styles[tone]}`}>
      <p className="text-[10px] uppercase tracking-widest font-700 opacity-70 leading-none mb-1">{label}</p>
      <p className="font-display font-800 text-2xl leading-none">{value}</p>
    </div>
  );
}

function ActionCard({ title, count, body, href, cta, tone = "gray" }: {
  title: string; count: number | string; body: string; href: string; cta: string; tone?: "gray" | "red" | "amber";
}) {
  const styles = {
    red:   { border: "border-red-200",  bg: "bg-red-50/80",  badge: "bg-red-100 text-red-700",   cta: "text-red-700"    },
    amber: { border: "border-amber/60", bg: "bg-amber/10",   badge: "bg-amber text-forge",        cta: "text-amber-dark" },
    gray:  { border: "border-gray-200", bg: "bg-white",      badge: "bg-forge text-white",        cta: "text-amber-dark" },
  } as const;
  const style = styles[tone];
  return (
    <Link
      href={href}
      className={`rounded-2xl border ${style.border} ${style.bg} p-4 flex min-h-[112px] items-center justify-between gap-3 transition-all hover:shadow-md hover:-translate-y-[1px]`}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-sm font-700 text-forge">
          {title}
          <ChevronRight className="h-3.5 w-3.5 text-steel shrink-0" />
        </p>
        <p className={`text-xs mt-1 ${tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-900" : "text-mist"}`}>{body}</p>
      </div>
      {typeof count === "number" && (
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display font-800 text-2xl ${count === 0 ? "bg-gray-100 text-gray-400" : style.badge}`}>
          {count}
        </div>
      )}
    </Link>
  );
}

function Metric({ label, value, sub, accent, urgent }: {
  label: string; value: string | number; sub?: string; accent?: boolean; urgent?: boolean;
}) {
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

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function MetricsHealthContent({ metrics, overdueCount, t }: {
  metrics: {
    revenueThisMonth: number;
    outstanding: number;
    completedThisMonth: number;
    avgJobHours: number | null;
    activeWorkers: number;
    pendingWorkOrders: number;
    estimateWinRate: number;
    estimateTotals: number;
  };
  overdueCount: number;
  t: TFn;
}) {
  return (
    <div className="space-y-3">
      <ActionCard
        title={t("dashboard.recurringHealth")}
        count={t("common.open")}
        body={t("dashboard.reviewRecurring")}
        href="/owner/reports/recurring-health"
        cta={t("dashboard.openReport")}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label={t("dashboard.revenueLabel")}     value={formatCurrency(metrics.revenueThisMonth)} accent />
        <Metric label={t("dashboard.outstanding")}      value={formatCurrency(metrics.outstanding)} urgent={overdueCount > 0} />
        <Metric label={t("dashboard.jobsDone")}         value={metrics.completedThisMonth} sub={metrics.avgJobHours != null ? `avg ${metrics.avgJobHours.toFixed(1)}h` : undefined} />
        <Metric label={t("dashboard.workersActive")}    value={metrics.activeWorkers} sub={t("dashboard.active")} />
        <Metric label={t("dashboard.estimateWinRate")}  value={`${metrics.estimateWinRate}%`} sub={`${metrics.estimateTotals} sent`} />
      </div>
    </div>
  );
}
