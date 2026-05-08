import { requireWorker } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate, JOB_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/utils";
import Link from "next/link";
import ClockWidget from "@/components/worker/ClockWidget";
import { getServerT } from "@/lib/i18n/server";

export default async function WorkerDashboard() {
  const profile = await requireWorker();
  const supabase = await createServerSideClient();
  const t = await getServerT();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("*, properties(name, address, city, state)")
    .eq("tenant_id", profile.tenant_id)
    .contains("assigned_workers", [profile.id])
    .in("status", ["scheduled", "in_progress", "pending"])
    .order("scheduled_date", { ascending: true });

  const today = new Date().toISOString().split("T")[0];
  const todayJobs    = jobs?.filter((j) => j.scheduled_date === today) || [];
  const upcomingJobs = jobs?.filter((j) => j.scheduled_date && j.scheduled_date > today) || [];
  const unscheduled  = jobs?.filter((j) => !j.scheduled_date) || [];
  const nextJob = [...todayJobs, ...upcomingJobs]
    .filter((j) => j.scheduled_date)
    .sort((a, b) => (a.scheduled_date || "").localeCompare(b.scheduled_date || ""))[0];

  const summary = [
    { label: t("dashboard.todayLabel"), value: todayJobs.length },
    { label: t("dashboard.upcoming"),   value: upcomingJobs.length },
    { label: t("dashboard.unscheduled"), value: unscheduled.length },
  ];

  return (
    <div className="page-shell max-w-3xl">
      {/* Hero banner */}
      <div className="bg-gradient-to-r from-forge to-steel text-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-amber/80 font-700">Worker</p>
            <h1 className="font-display font-800 text-2xl">{t("nav.myJobs")}</h1>
            <p className="text-sm text-white/70">{formatDate(new Date())}</p>
          </div>
          <Link
            href="/worker/timesheets"
            className="inline-flex items-center gap-2 bg-white text-forge font-700 px-3 py-2 rounded-xl text-sm shadow-sm hover:shadow transition"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t("nav.timesheet")}
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {summary.map((s) => (
            <div key={s.label} className="bg-white/10 rounded-xl px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-white/70">{s.label}</p>
              <p className="font-display font-800 text-xl">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <ClockWidget />

      {/* Next up card */}
      <div className="surface-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-700 text-forge">{t("dashboard.nextUp")}</p>
          {nextJob ? (
            <span className="text-xs text-mist">
              {nextJob.scheduled_date ? formatDate(nextJob.scheduled_date) : t("dashboard.noDateSet")}
              {nextJob.scheduled_time ? ` at ${nextJob.scheduled_time}` : ""}
            </span>
          ) : (
            <span className="text-xs text-mist">{t("dashboard.noUpcomingJobs")}</span>
          )}
        </div>
        {nextJob ? (
          <Link
            href={`/worker/jobs/${nextJob.id}`}
            className="block mt-2 p-3 rounded-lg border border-gray-100 hover:border-amber transition-colors"
          >
            <p className="font-600 text-forge">{nextJob.title}</p>
            {nextJob.properties && (
              <div className="text-xs text-mist mt-0.5 space-y-0.5">
                {nextJob.properties.address && (
                  <p className="font-600 text-forge/90">{nextJob.properties.address}</p>
                )}
                <p>{nextJob.properties.name} &middot; {nextJob.properties.city}, {nextJob.properties.state}</p>
              </div>
            )}
          </Link>
        ) : (
          <p className="text-xs text-mist mt-1">{t("dashboard.enjoyDowntime")}</p>
        )}
      </div>

      {/* Today */}
      {todayJobs.length > 0 && (
        <section aria-labelledby="today-heading">
          <h2 id="today-heading" className="font-display font-700 text-lg text-forge mb-3 flex items-center gap-2">
            {t("dashboard.todayLabel")}
            <span className="w-5 h-5 bg-amber text-forge text-xs font-700 rounded-full flex items-center justify-center">
              {todayJobs.length}
            </span>
          </h2>
          <div className="space-y-3">
            {todayJobs.map((job: any) => <WorkerJobCard key={job.id} job={job} highlight t={t} />)}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcomingJobs.length > 0 && (
        <section aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="font-display font-700 text-lg text-forge mb-3">{t("dashboard.upcoming")}</h2>
          <div className="space-y-3">
            {upcomingJobs.map((job: any) => <WorkerJobCard key={job.id} job={job} t={t} />)}
          </div>
        </section>
      )}

      {/* Unscheduled */}
      {unscheduled.length > 0 && (
        <section aria-labelledby="unscheduled-heading">
          <h2 id="unscheduled-heading" className="font-display font-700 text-lg text-forge mb-3">{t("dashboard.unscheduled")}</h2>
          <div className="space-y-3">
            {unscheduled.map((job: any) => <WorkerJobCard key={job.id} job={job} t={t} />)}
          </div>
        </section>
      )}

      {!jobs?.length && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-amber/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-display font-700 text-xl text-forge">{t("dashboard.allCaughtUp")}</p>
          <p className="text-mist text-sm mt-1">{t("dashboard.noJobsAssigned")}</p>
        </div>
      )}
    </div>
  );
}

type TFn = (key: string, vars?: Record<string, string | number>) => string;
function WorkerJobCard({ job, highlight, t }: { job: any; highlight?: boolean; t: TFn }) {
  const statusCfg   = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
  const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];

  return (
    <Link
      href={`/worker/jobs/${job.id}`}
      className={`block rounded-xl border p-4 transition-all hover:shadow-md ${
        highlight ? "bg-amber/5 border-amber" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-600 text-forge text-base leading-tight">{job.title}</h3>
        <span className={`badge shrink-0 ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
      </div>
      {job.properties && (
        <p className="text-sm text-mist">
          {job.properties.name} &middot; {job.properties.city}, {job.properties.state}
        </p>
      )}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-mist flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {job.scheduled_date ? formatDate(job.scheduled_date) : t("dashboard.noDateSet")}
          {job.scheduled_time && ` at ${job.scheduled_time}`}
        </span>
        <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
      </div>
    </Link>
  );
}
