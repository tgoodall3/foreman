import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { getOwnerDashboardData } from "@/lib/services/owner";
import { formatCurrency, formatDate, JOB_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/utils";
import WorkOrderInlineActions from "@/components/owner/WorkOrderInlineActions";
import MessagePM from "@/components/owner/MessagePM";
import QuickAssign from "@/components/owner/QuickAssign";
import { getServerT } from "@/lib/i18n/server";
import {
  Briefcase, FileText, Receipt, CalendarDays, ChevronRight,
  TrendingUp, AlertCircle, Clock, Users, type LucideIcon,
} from "lucide-react";

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
  if ((workerCount ?? 0) === 0 && (pmCount ?? 0) === 0) redirect("/owner/onboarding");

  const { today, todayJobs, upcomingJobs, workOrders, workers, metrics, actions } =
    await getOwnerDashboardData(profile);

  const workerMap      = Object.fromEntries(workers.map((w: any) => [w.id, w.full_name]));
  const overdueCount   = actions.overdueInvoices.length;
  const overdueTotal   = actions.overdueInvoices.reduce((s: number, i: any) => s + (i.total ?? 0), 0);
  const unassignedToday = todayJobs.filter((j: any) => !j.assigned_workers || j.assigned_workers.length === 0).length;

  const { count: clockedInCount } = await supabase
    .from("time_entries")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id)
    .is("clocked_out_at", null);

  const quickActions: { href: string; label: string; icon: LucideIcon; desc: string }[] = [
    { href: "/owner/jobs/new",      label: t("dashboard.newJob"),      icon: Briefcase,   desc: "Schedule work" },
    { href: "/owner/estimates/new", label: t("dashboard.newEstimate"), icon: FileText,    desc: "Send a quote"  },
    { href: "/owner/invoices/new",  label: t("dashboard.newInvoice"),  icon: Receipt,     desc: "Bill a client" },
    { href: "/owner/schedule",      label: t("nav.schedule"),          icon: CalendarDays, desc: "View calendar" },
  ];

  return (
    <div className="page-shell page-shell-standard">

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-forge via-forge-light to-[#1e2f42] px-5 py-6 sm:px-7 sm:py-7">
        {/* Subtle grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }}
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-amber font-600 mb-1">
              {t("dashboard.todayLabel")}
            </p>
            <h1 className="font-display font-800 text-3xl sm:text-4xl text-white leading-tight">
              {formatDate(today)}
            </h1>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5">
            <KpiCard label={t("dashboard.jobsToday")}  value={todayJobs.length}    tone="neutral" />
            <KpiCard label={t("dashboard.unassigned")} value={unassignedToday}     tone={unassignedToday ? "amber" : "neutral"} />
            <KpiCard label={t("dashboard.clockedIn")}  value={clockedInCount ?? 0} tone={(clockedInCount ?? 0) > 0 ? "green" : "neutral"} />
            <KpiCard label={t("dashboard.overdueInv")} value={overdueCount}        tone={overdueCount ? "red" : "neutral"} />
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <SectionCard title={t("dashboard.quickActions")}>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {quickActions.map(({ href, label, icon: Icon, desc }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-4 transition-all hover:border-amber/60 hover:bg-white hover:shadow-card-md"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber/15 text-amber transition-colors group-hover:bg-amber group-hover:text-forge">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-600 text-forge leading-tight">{label}</p>
                <p className="text-xs text-mist mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
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
              tone="amber"
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
      </SectionCard>

      {/* Jobs */}
      <div className="surface-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div>
            <h2 className="font-display font-700 text-lg text-forge tracking-wide">{t("nav.jobs")}</h2>
            <p className="text-xs text-mist mt-0.5">
              {todayJobs.length + upcomingJobs.length > 0
                ? `${todayJobs.length} today · ${upcomingJobs.length} upcoming`
                : t("dashboard.nothingScheduled")}
            </p>
          </div>
          <Link
            href="/owner/schedule"
            className="action-button-dark text-xs px-3 py-1.5 min-h-[32px]"
          >
            {t("dashboard.openSchedule")} <ChevronRight className="h-3.5 w-3.5 -mr-0.5" />
          </Link>
        </div>

        {/* Today */}
        <div>
          <div className="flex items-center gap-2 px-5 py-2 bg-amber/5 border-b border-amber/10">
            <span className="text-[11px] uppercase tracking-[0.2em] font-600 text-amber-dark">Today</span>
          </div>
          {todayJobs.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-mist">{t("dashboard.scheduleTodayNote")}</div>
          ) : (
            <div className="divide-y divide-gray-100/80">
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
                    className={`mx-4 my-2 rounded-xl border transition-all ${
                      isUnassigned
                        ? "border-amber/40 bg-amber/4"
                        : "border-gray-200/70 bg-white"
                    }`}
                  >
                    <Link href={`/owner/jobs/${job.id}`} className="block px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1.5">
                          <p className="text-sm font-600 text-forge line-clamp-1">{job.title}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            {prop?.name && <span className="text-xs text-mist">{prop.name}</span>}
                            {job.estimated_hours && (
                              <span className="text-xs text-mist tabular-nums">{job.estimated_hours}h planned</span>
                            )}
                            {isUnassigned && (
                              <span className="inline-flex items-center rounded-full bg-amber/25 px-2 py-0.5 text-[11px] font-600 text-amber-900">
                                Unassigned
                              </span>
                            )}
                          </div>
                          {assignedNames.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {assignedNames.map((name) => (
                                <span
                                  key={name}
                                  className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-600 text-steel"
                                >
                                  {name.split(" ")[0]}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                          <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                          <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                        </div>
                      </div>
                    </Link>
                    <div className="border-t border-gray-100 px-4 py-2 flex justify-end">
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

        {/* Upcoming */}
        <div className="border-t border-gray-100">
          <div className="flex items-center gap-2 px-5 py-2 bg-gray-50/60 border-b border-gray-100">
            <span className="text-[11px] uppercase tracking-[0.2em] font-600 text-mist">Upcoming</span>
          </div>
          {upcomingJobs.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-mist">{t("dashboard.noUpcomingJobs")}</div>
          ) : (
            <div className="divide-y divide-gray-100/80">
              {upcomingJobs.map((job: any) => {
                const statusCfg   = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
                const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];
                const prop = Array.isArray(job.properties) ? job.properties[0] : job.properties;
                return (
                  <Link
                    key={job.id}
                    href={`/owner/jobs/${job.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-600 text-forge line-clamp-1">{job.title}</p>
                      <p className="text-xs text-mist mt-0.5">
                        {prop?.name ? `${prop.name} · ` : ""}
                        {job.scheduled_date ? formatDate(job.scheduled_date) : "Not scheduled"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                      <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Work Orders */}
      <div className="surface-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div>
            <h2 className="font-display font-700 text-lg text-forge tracking-wide">{t("nav.workOrders")}</h2>
            <p className="text-xs text-mist mt-0.5">{t("workOrders.pendingTab")}</p>
          </div>
          <Link href="/owner/work-orders" className="action-button-dark text-xs px-3 py-1.5 min-h-[32px]">
            {t("common.open")} <ChevronRight className="h-3.5 w-3.5 -mr-0.5" />
          </Link>
        </div>
        <div className="divide-y divide-gray-100/80">
          {!workOrders?.length ? (
            <div className="px-5 py-10 text-center text-sm text-mist">{t("workOrders.noWorkOrders")}</div>
          ) : (
            workOrders.map((wo: any) => {
              const priorityCfg = PRIORITY_CONFIG[wo.priority as keyof typeof PRIORITY_CONFIG];
              const pm   = Array.isArray(wo.property_managers) ? wo.property_managers[0] : wo.property_managers;
              const prop = Array.isArray(wo.properties) ? wo.properties[0] : wo.properties;
              return (
                <div key={wo.id} className="px-5 py-3 space-y-2.5">
                  <Link
                    href={`/owner/work-orders/${wo.id}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-gray-200/80 px-3.5 py-3 hover:bg-gray-50 hover:shadow-card transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-600 text-forge line-clamp-1">{wo.title}</p>
                      <p className="text-xs text-mist mt-0.5">{pm?.full_name}{prop?.name ? ` · ${prop.name}` : ""}</p>
                    </div>
                    <span className={`badge shrink-0 ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                  </Link>
                  <div className="space-y-2 pl-0.5">
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
      </div>

      {/* Billing */}
      <SectionCard title={t("dashboard.billing")}>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
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
      </SectionCard>

      {/* Metrics — mobile collapsible */}
      <details className="group surface-card overflow-hidden md:hidden [&_summary::-webkit-details-marker]:hidden">
        <summary className="list-none cursor-pointer px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display font-700 text-base text-forge tracking-wide">{t("dashboard.metricsHealth")}</p>
              <p className="text-xs text-mist mt-0.5">
                {formatCurrency(metrics.revenueThisMonth)} revenue · {formatCurrency(metrics.outstanding)} outstanding
              </p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-steel transition-transform group-open:rotate-180">
              <ChevronRight className="h-4 w-4 rotate-90" />
            </span>
          </div>
        </summary>
        <div className="border-t border-gray-100 p-5">
          <MetricsContent metrics={metrics} overdueCount={overdueCount} t={t} />
        </div>
      </details>

      {/* Metrics — desktop */}
      <SectionCard title={t("dashboard.metricsHealth")} className="hidden md:block">
        <MetricsContent metrics={metrics} overdueCount={overdueCount} t={t} />
      </SectionCard>

    </div>
  );
}

/* ── Sub-components ── */

function SectionCard({
  title, subtitle, action, children, className = "",
}: {
  title: string; subtitle?: string; action?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`surface-card overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div>
          <h2 className="font-display font-700 text-lg text-forge tracking-wide">{title}</h2>
          {subtitle && <p className="text-xs text-mist mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function KpiCard({ label, value, tone }: {
  label: string; value: number | string;
  tone: "neutral" | "amber" | "green" | "red";
}) {
  const styles = {
    neutral: "bg-white/10 text-white border-white/10",
    amber:   "bg-amber text-forge border-amber/80",
    green:   "bg-emerald-500/25 text-emerald-100 border-emerald-500/20",
    red:     "bg-red-500/25 text-red-100 border-red-500/20",
  } as const;
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${styles[tone]}`}>
      <p className="text-[10px] uppercase tracking-widest font-600 opacity-60 leading-none mb-1.5">{label}</p>
      <p className="font-display font-800 text-2xl leading-none tabular-nums">{value}</p>
    </div>
  );
}

function ActionCard({
  title, count, body, href, cta, tone = "neutral",
}: {
  title: string; count: number | string; body: string;
  href: string; cta: string; tone?: "neutral" | "red" | "amber";
}) {
  const styles = {
    red:     { wrap: "border-red-200 bg-red-50/60",  badge: "bg-red-100 text-red-700",  cta: "text-red-600"    },
    amber:   { wrap: "border-amber/50 bg-amber/8",   badge: "bg-amber text-forge",       cta: "text-amber-dark" },
    neutral: { wrap: "border-gray-200 bg-white",     badge: "bg-forge text-white",       cta: "text-amber-dark" },
  } as const;
  const s = styles[tone];

  return (
    <Link
      href={href}
      className={`group flex items-center justify-between gap-3 rounded-xl border ${s.wrap} p-4 transition-all hover:shadow-card-md hover:-translate-y-px`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1 mb-1">
          <p className="text-sm font-600 text-forge">{title}</p>
          <ChevronRight className="h-3.5 w-3.5 text-mist shrink-0 transition-transform group-hover:translate-x-0.5" />
        </div>
        <p className={`text-xs ${tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-900" : "text-mist"}`}>
          {body}
        </p>
      </div>
      {typeof count === "number" && (
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display font-800 text-2xl tabular-nums ${count === 0 ? "bg-gray-100 text-gray-400" : s.badge}`}>
          {count}
        </div>
      )}
    </Link>
  );
}

function MetricTile({
  label, value, sub, accent, urgent,
}: {
  label: string; value: string | number; sub?: string; accent?: boolean; urgent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${urgent ? "border-red-200 bg-red-50/40" : "border-gray-200"}`}>
      <p className="text-[11px] uppercase tracking-[0.15em] text-mist font-600 leading-none">{label}</p>
      <p className={`font-display font-800 text-2xl mt-2 leading-none tabular-nums ${
        accent ? "text-amber-dark" : urgent ? "text-red-600" : "text-forge"
      }`}>
        {value}
      </p>
      {sub && <p className="text-xs text-mist mt-1.5">{sub}</p>}
    </div>
  );
}

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function MetricsContent({ metrics, overdueCount, t }: {
  metrics: {
    revenueThisMonth: number; outstanding: number; completedThisMonth: number;
    avgJobHours: number | null; activeWorkers: number;
    pendingWorkOrders: number; estimateWinRate: number; estimateTotals: number;
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
        <MetricTile label={t("dashboard.revenueLabel")}    value={formatCurrency(metrics.revenueThisMonth)} accent />
        <MetricTile label={t("dashboard.outstanding")}     value={formatCurrency(metrics.outstanding)} urgent={overdueCount > 0} />
        <MetricTile label={t("dashboard.jobsDone")}        value={metrics.completedThisMonth}
          sub={metrics.avgJobHours != null ? `avg ${metrics.avgJobHours.toFixed(1)}h` : undefined} />
        <MetricTile label={t("dashboard.workersActive")}   value={metrics.activeWorkers} sub={t("dashboard.active")} />
        <MetricTile label={t("dashboard.estimateWinRate")} value={`${metrics.estimateWinRate}%`} sub={`${metrics.estimateTotals} sent`} />
      </div>
    </div>
  );
}
