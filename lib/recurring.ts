import { SupabaseClient } from "@supabase/supabase-js";

/** Returns the next scheduled_date string (YYYY-MM-DD) given a recurrence rule and a base date. */
export function nextDate(baseDate: string, recurrence: string): string | null {
  if (!baseDate || recurrence === "none") return null;

  const d = new Date(baseDate + "T00:00:00Z");

  switch (recurrence) {
    case "daily":    d.setUTCDate(d.getUTCDate() + 1);  break;
    case "weekly":   d.setUTCDate(d.getUTCDate() + 7);  break;
    case "biweekly": d.setUTCDate(d.getUTCDate() + 14); break;
    case "monthly":  d.setUTCMonth(d.getUTCMonth() + 1); break;
    default: return null;
  }

  return d.toISOString().split("T")[0];
}

/**
 * If the job has a recurrence rule, create the next occurrence.
 * Called fire-and-forget when a job is marked complete.
 */
export async function maybeCreateNextOccurrence(
  supabase: SupabaseClient,
  jobId: string,
  tenantId: string
): Promise<void> {
  const { data: job } = await supabase
    .from("jobs")
    .select("title, description, priority, recurrence, scheduled_date, scheduled_time, estimated_hours, property_id, assigned_workers, tenant_id")
    .eq("id", jobId)
    .eq("tenant_id", tenantId)
    .single();

  if (!job || !job.recurrence || job.recurrence === "none") return;

  const next = nextDate(job.scheduled_date, job.recurrence);
  if (!next) return;

  await supabase.from("jobs").insert({
    tenant_id:       job.tenant_id,
    title:           job.title,
    description:     job.description,
    priority:        job.priority,
    recurrence:      job.recurrence,
    parent_job_id:   jobId,
    status:          "scheduled",
    scheduled_date:  next,
    scheduled_time:  job.scheduled_time,
    estimated_hours: job.estimated_hours,
    property_id:     job.property_id,
    assigned_workers: job.assigned_workers,
  });
}
