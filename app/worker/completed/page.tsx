import { requireWorker } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

function biweeklyLabel(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString("en-US", { month: "long", year: "numeric" });
  return d.getDate() <= 14 ? `${month} (1–14)` : `${month} (15–31)`;
}

export default async function CompletedJobsPage() {
  const profile  = await requireWorker();
  const supabase = await createServerSideClient();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, updated_at, created_at, properties(name, city, state)")
    .eq("tenant_id", profile.tenant_id)
    .contains("assigned_workers", [profile.id])
    .in("status", ["completed", "invoiced", "cancelled"])
    .order("updated_at", { ascending: false });

  // Group by biweekly period
  const groups: Record<string, typeof jobs> = {};
  for (const job of jobs ?? []) {
    const label = biweeklyLabel(job.updated_at ?? job.created_at);
    if (!groups[label]) groups[label] = [];
    groups[label]!.push(job);
  }

  const totalCount = jobs?.length ?? 0;

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display font-800 text-2xl text-forge">Past Jobs</h1>
          {totalCount > 0 && <p className="text-mist text-xs mt-0.5">{totalCount} total</p>}
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-mist text-sm">No past jobs yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([label, items]) => (
            <div key={label}>
              <p className="text-xs font-700 uppercase tracking-widest text-mist mb-2 px-1">{label}</p>
              <div className="space-y-2">
                {(items ?? []).map((job: any) => (
                  <Link
                    key={job.id}
                    href={`/worker/jobs/${job.id}`}
                    className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-600 text-forge">{job.title}</p>
                        {job.properties && (
                          <p className="text-xs text-mist mt-0.5">
                            {job.properties.name}{job.properties.city ? ` · ${job.properties.city}` : ""}
                          </p>
                        )}
                      </div>
                      <span className={`badge shrink-0 ${job.status === "cancelled" ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}`}>
                        {job.status === "cancelled" ? "Cancelled" : "Done"}
                      </span>
                    </div>
                    <p className="text-xs text-mist mt-2">{formatDate(job.updated_at ?? job.created_at)}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
