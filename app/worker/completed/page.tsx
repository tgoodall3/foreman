import { requireWorker } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default async function CompletedJobsPage() {
  const profile = await requireWorker();
  const supabase = await createServerSideClient();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("*, properties(name, city, state)")
    .eq("tenant_id", profile.tenant_id)
    .contains("assigned_workers", [profile.id])
    .in("status", ["completed", "invoiced"])
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="font-display font-800 text-2xl text-forge mb-4">Completed Jobs</h1>
      {!jobs?.length ? (
        <div className="text-center py-16">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-mist text-sm">No completed jobs yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job: any) => (
            <Link key={job.id} href={`/worker/jobs/${job.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-600 text-forge">{job.title}</p>
                  {job.properties && <p className="text-xs text-mist mt-0.5">{job.properties.name} · {job.properties.city}</p>}
                </div>
                <span className="badge bg-green-100 text-green-700 shrink-0">Done</span>
              </div>
              <p className="text-xs text-mist mt-2">{job.updated_at ? formatDate(job.updated_at) : "—"}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
