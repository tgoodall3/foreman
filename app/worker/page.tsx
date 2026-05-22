import { requireWorker } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate, JOB_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/utils";
import Link from "next/link";
import ClockWidget from "@/components/worker/ClockWidget";
import { getServerT } from "@/lib/i18n/server";
import { CheckCircle } from "lucide-react";

export default async function WorkerDashboard() {
  const profile  = await requireWorker();
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
    <div className="page-shell page-shell-standard">

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-forge via-forge-light to-[#1e2f42] px-5 py-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }}
          aria-hidden="true"
        />
        <div className="relative">
          <p className="text-[11px] uppercase tracking-[0.25em] text-amber font-600 mb-1">{t("nav.myJobs")}</p>
          <h1 className="font-display font-800 text-3xl text-white leading-tight">
            {formatDate(new Date())}
          </h1>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <WorkerKpi label={t("dashboard.todayLabel")} value={todayJobs.length}    tone={todayJobs.length ? "amber" : "neutral"} />
            <WorkerKpi label={t("dashboard.upcoming")}   value={upcomingJobs.length} tone="neutral" />
            <WorkerKpi label={t("dashboard.unscheduled")} value={unscheduled.length} tone="neutral" />
          </div>
        </div>
      </div>

      <ClockWidget />

      {jobs?.length ? (
        <>
          {todayJobs.length > 0 && (
            <JobSection
              label={t("dashboard.todayLabel")}
              count={todayJobs.length}
              accent
            >
              {todayJobs.map((job: any) => (
                <WorkerJobRow key={job.id} job={job} highlight t={t} />
              ))}
            </JobSection>
          )}

          {upcomingJobs.length > 0 && (
            <JobSection label={t("dashboard.upcoming")}>
              {upcomingJobs.map((job: any) => (
                <WorkerJobRow key={job.id} job={job} t={t} />
              ))}
            </JobSection>
          )}

          {unscheduled.length > 0 && (
            <JobSection label={t("dashboard.unscheduled")}>
              {unscheduled.map((job: any) => (
                <WorkerJobRow key={job.id} job={job} t={t} />
              ))}
            </JobSection>
          )}
        </>
      ) : (
        <div className="surface-card flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 mb-5">
            <CheckCircle className="h-7 w-7 text-emerald-500" />
          </div>
          <p className="font-display font-700 text-xl text-forge tracking-wide">{t("dashboard.allCaughtUp")}</p>
          <p className="text-mist text-sm mt-1.5 max-w-[220px]">{t("dashboard.noJobsAssigned")}</p>
        </div>
      )}
    </div>
  );
}

function JobSection({
  label, count, accent = false, children,
}: {
  label: string; count?: number; accent?: boolean; children: React.ReactNode;
}) {
  return (
    <section className="surface-card overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-3 border-b ${accent ? "bg-amber/5 border-amber/15" : "border-gray-100"}`}>
        <p className={`text-[11px] uppercase tracking-[0.2em] font-600 ${accent ? "text-amber-dark" : "text-mist"}`}>
          {label}
        </p>
        {count !== undefined && (
          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-700 ${accent ? "bg-amber text-forge" : "bg-gray-200 text-gray-600"}`}>
            {count}
          </span>
        )}
      </div>
      <div className="divide-y divide-gray-100/80 px-3 py-2 space-y-1.5">
        {children}
      </div>
    </section>
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
      className={[
        "flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 transition-all hover:shadow-card",
        highlight
          ? "bg-amber/5 border-amber/30 hover:bg-amber/8"
          : "bg-white border-gray-200/70 hover:bg-gray-50",
      ].join(" ")}
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-600 text-forge line-clamp-1">{job.title}</p>
        <p className="text-xs text-mist line-clamp-1">{meta}</p>
      </div>
      <div className="ml-2 flex shrink-0 flex-wrap justify-end gap-1.5">
        <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
        <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
      </div>
    </Link>
  );
}

function WorkerKpi({ label, value, tone }: {
  label: string; value: number;
  tone: "neutral" | "amber";
}) {
  const styles = {
    neutral: "bg-white/10 text-white border-white/10",
    amber:   "bg-amber text-forge border-amber/80",
  } as const;
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${styles[tone]}`}>
      <p className="text-[10px] uppercase tracking-widest font-600 opacity-60 leading-none mb-1">{label}</p>
      <p className="font-display font-800 text-2xl leading-none">{value}</p>
    </div>
  );
}
