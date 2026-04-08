import { requireWorker } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate, JOB_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/utils";
import Link from "next/link";

export default async function WorkerDashboard() {
  const profile = await requireWorker();
  const supabase = await createServerSideClient();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("*, properties(name, address, city, state)")
    .eq("tenant_id", profile.tenant_id)
    .contains("assigned_workers", [profile.id])
    .in("status", ["scheduled", "in_progress", "pending"])
    .order("scheduled_date", { ascending: true });

  const today = new Date().toISOString().split("T")[0];
  const todayJobs = jobs?.filter((j) => j.scheduled_date === today) || [];
  const upcomingJobs = jobs?.filter((j) => j.scheduled_date && j.scheduled_date > today) || [];
  const unscheduled = jobs?.filter((j) => !j.scheduled_date) || [];

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="font-display font-800 text-2xl text-forge">My Jobs</h1>
        <p className="text-mist text-sm">{formatDate(new Date())}</p>
      </div>

      {/* Today */}
      {todayJobs.length > 0 && (
        <section aria-labelledby="today-heading" className="mb-6">
          <h2 id="today-heading" className="font-display font-700 text-lg text-forge mb-3 flex items-center gap-2">
            Today
            <span className="w-5 h-5 bg-amber text-forge text-xs font-700 rounded-full flex items-center justify-center">
              {todayJobs.length}
            </span>
          </h2>
          <div className="space-y-3">
            {todayJobs.map((job: any) => <WorkerJobCard key={job.id} job={job} highlight />)}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcomingJobs.length > 0 && (
        <section aria-labelledby="upcoming-heading" className="mb-6">
          <h2 id="upcoming-heading" className="font-display font-700 text-lg text-forge mb-3">Upcoming</h2>
          <div className="space-y-3">
            {upcomingJobs.map((job: any) => <WorkerJobCard key={job.id} job={job} />)}
          </div>
        </section>
      )}

      {/* Unscheduled */}
      {unscheduled.length > 0 && (
        <section aria-labelledby="unscheduled-heading" className="mb-6">
          <h2 id="unscheduled-heading" className="font-display font-700 text-lg text-forge mb-3">Unscheduled</h2>
          <div className="space-y-3">
            {unscheduled.map((job: any) => <WorkerJobCard key={job.id} job={job} />)}
          </div>
        </section>
      )}

      {!jobs?.length && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-display font-700 text-xl text-forge">All caught up!</p>
          <p className="text-mist text-sm mt-1">No jobs assigned right now</p>
        </div>
      )}
    </div>
  );
}

function WorkerJobCard({ job, highlight }: { job: any; highlight?: boolean }) {
  const statusCfg = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
  const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];

  return (
    <Link
      href={`/worker/jobs/${job.id}`}
      className={`block rounded-xl border p-4 transition-all hover:shadow-md ${
        highlight
          ? "bg-amber/5 border-amber"
          : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-600 text-forge text-base leading-tight">{job.title}</h3>
        <span className={`badge shrink-0 ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
      </div>
      {job.properties && (
        <p className="text-sm text-mist">{job.properties.name} · {job.properties.city}, {job.properties.state}</p>
      )}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-mist">
          {job.scheduled_date ? `📅 ${formatDate(job.scheduled_date)}` : "No date set"}
          {job.scheduled_time && ` at ${job.scheduled_time}`}
        </span>
        <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
      </div>
    </Link>
  );
}
