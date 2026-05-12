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

  const today        = new Date().toISOString().split("T")[0];
  const todayJobs    = jobs?.filter((j) => j.scheduled_date === today) ?? [];
  const upcomingJobs = jobs?.filter((j) => j.scheduled_date && j.scheduled_date > today) ?? [];
  const unscheduled  = jobs?.filter((j) => !j.scheduled_date) ?? [];

  return (
    <div className="page-shell page-shell-standard lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-mist font-700">{t("nav.myJobs")}</p>
          <h1 className="font-display font-800 text-3xl text-forge leading-tight">{formatDate(new Date())}</h1>
        </div>
        <div className="grid grid-cols-3 sm:flex sm:items-center gap-2">
          <Kpi label={t("dashboard.todayLabel")} value={todayJobs.length} tone={todayJobs.length ? "amber" : "steel"} />
          <Kpi label={t("dashboard.upcoming")}   value={upcomingJobs.length} tone="forge" />
          <Kpi label={t("dashboard.unscheduled")} value={unscheduled.length} tone="steel" />
        </div>
      </div>

      <ClockWidget />

      {jobs?.length ? (
        <>
          {todayJobs.length > 0 && (
            <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <header className="flex items-center justify-between px-3 py-3 sm:px-4 border-b border-gray-100">
                <p className="text-xs text-mist uppercase tracking-wide font-700">{t("dashboard.todayLabel")}</p>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber text-forge text-[11px] font-700">
                  {todayJobs.length}
                </span>
              </header>
              <div className="divide-y divide-gray-100">
                {todayJobs.map((job: any) => (
                  <div key={job.id} className="px-2 py-2 sm:px-3">
                    <WorkerJobRow job={job} highlight t={t} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {upcomingJobs.length > 0 && (
            <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <header className="px-3 py-3 sm:px-4 border-b border-gray-100">
                <p className="text-xs text-mist uppercase tracking-wide font-700">{t("dashboard.upcoming")}</p>
              </header>
              <div className="divide-y divide-gray-100">
                {upcomingJobs.map((job: any) => (
                  <div key={job.id} className="px-2 py-2 sm:px-3">
                    <WorkerJobRow job={job} t={t} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {unscheduled.length > 0 && (
            <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <header className="px-3 py-3 sm:px-4 border-b border-gray-100">
                <p className="text-xs text-mist uppercase tracking-wide font-700">{t("dashboard.unscheduled")}</p>
              </header>
              <div className="divide-y divide-gray-100">
                {unscheduled.map((job: any) => (
                  <div key={job.id} className="px-2 py-2 sm:px-3">
                    <WorkerJobRow job={job} t={t} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-12 text-center">
          <div className="w-12 h-12 bg-amber/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-display font-700 text-lg text-forge">{t("dashboard.allCaughtUp")}</p>
          <p className="text-mist text-sm mt-1">{t("dashboard.noJobsAssigned")}</p>
        </div>
      )}
    </div>
  );
}

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function WorkerJobRow({ job, highlight, t }: { job: any; highlight?: boolean; t: TFn }) {
  const statusCfg   = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
  const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];

  const meta = [
    job.properties?.name,
    job.scheduled_date
      ? `${formatDate(job.scheduled_date)}${job.scheduled_time ? ` at ${job.scheduled_time}` : ""}`
      : t("dashboard.noDateSet"),
  ].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/worker/jobs/${job.id}`}
      className={`flex min-h-[60px] items-center justify-between gap-3 rounded-xl border px-3 py-3 transition-colors hover:bg-gray-50 ${
        highlight ? "bg-amber/5 border-amber/30" : "bg-white border-gray-200/80"
      }`}
    >
      <div className="min-w-0">
        <p className="line-clamp-1 text-sm font-700 text-forge">{job.title}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-mist">{meta}</p>
      </div>
      <div className="ml-2 flex shrink-0 flex-wrap justify-end gap-2">
        <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
        <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
      </div>
    </Link>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number | string; tone: "forge" | "amber" | "green" | "red" | "steel" }) {
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
