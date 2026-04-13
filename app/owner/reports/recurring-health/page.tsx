import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RECURRENCE_MAP: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 31, // simple heuristic
};

export default async function RecurringHealthPage() {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, recurrence, scheduled_date, updated_at, properties(name)")
    .eq("tenant_id", profile.tenant_id)
    .neq("recurrence", "none")
    .order("scheduled_date", { ascending: true });

  const flagged = (jobs ?? []).filter((job: any) => {
    if (!job.scheduled_date) return false;
    const days = RECURRENCE_MAP[job.recurrence as keyof typeof RECURRENCE_MAP] ?? 7;
    const dueDate = new Date(job.scheduled_date + "T00:00:00Z");
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    return job.status !== "completed" && dueDate < new Date(today) && dueDate < cutoff;
  });

  return (
    <div className="page-shell page-shell-standard">
      <div className="page-header-copy">
        <p className="page-eyebrow">Reports</p>
        <h1 className="page-title">Recurring Job Health</h1>
        <p className="page-subtitle">Recurring jobs that are overdue or likely missed.</p>
      </div>

      {!flagged.length ? (
        <div className="surface-empty">
          No overdue recurring jobs — all caught up.
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          {/* Desktop table */}
          <table className="hidden sm:table w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">Job</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">Recurrence</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">Scheduled</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-right text-xs font-700 text-mist uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {flagged.map((job: any) => {
                const prop = Array.isArray(job.properties) ? job.properties[0] : job.properties;
                return (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/owner/jobs/${job.id}`} className="text-forge font-600 hover:text-amber">
                        {job.title}
                      </Link>
                      {prop?.name && <p className="text-xs text-mist mt-0.5">{prop.name}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-steel capitalize">{job.recurrence}</td>
                    <td className="px-4 py-3 text-sm text-steel">{job.scheduled_date ? formatDate(job.scheduled_date) : "—"}</td>
                    <td className="px-4 py-3 text-sm text-steel capitalize">{job.status}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/owner/jobs/${job.id}/edit`} className="text-xs font-700 text-amber hover:underline">
                        Reschedule
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {flagged.map((job: any) => {
              const prop = Array.isArray(job.properties) ? job.properties[0] : job.properties;
              return (
                <div key={job.id} className="px-4 py-3 space-y-2">
                  <div className="min-w-0">
                    <Link href={`/owner/jobs/${job.id}`} className="text-forge font-600 hover:text-amber text-sm">
                      {job.title}
                    </Link>
                    {prop?.name && <p className="text-xs text-mist mt-0.5">{prop.name}</p>}
                    <p className="text-xs text-steel mt-0.5 capitalize">
                      {job.recurrence} &middot; scheduled {job.scheduled_date ? formatDate(job.scheduled_date) : "—"} &middot; {job.status}
                    </p>
                  </div>
                  <Link
                    href={`/owner/jobs/${job.id}/edit`}
                    className="inline-flex items-center bg-amber text-forge text-xs font-700 px-3 py-1.5 rounded-lg hover:bg-amber-dark transition-colors"
                  >
                    Reschedule
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
