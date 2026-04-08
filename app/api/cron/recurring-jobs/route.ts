import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { nextDate } from "@/lib/recurring";

/**
 * Daily cron (06:00 UTC) — safety net for recurring jobs.
 * For every completed recurring job that has NO future child, create the next occurrence.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Find completed recurring jobs (non-none recurrence, no child yet)
  const { data: recurring } = await supabase
    .from("jobs")
    .select("id, tenant_id, title, description, priority, recurrence, scheduled_date, scheduled_time, estimated_hours, property_id, assigned_workers")
    .in("status", ["completed", "invoiced"])
    .neq("recurrence", "none")
    .not("recurrence", "is", null);

  if (!recurring?.length) return NextResponse.json({ ok: true, created: 0 });

  let created = 0;

  for (const job of recurring) {
    // Check if a child already exists
    const { count } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("parent_job_id", job.id)
      .not("status", "in", '("completed","invoiced","cancelled")');

    if ((count ?? 0) > 0) continue; // already has an active child

    const next = nextDate(job.scheduled_date, job.recurrence);
    if (!next) continue;

    await supabase.from("jobs").insert({
      tenant_id:       job.tenant_id,
      title:           job.title,
      description:     job.description,
      priority:        job.priority,
      recurrence:      job.recurrence,
      parent_job_id:   job.id,
      status:          "scheduled",
      scheduled_date:  next,
      scheduled_time:  job.scheduled_time,
      estimated_hours: job.estimated_hours,
      property_id:     job.property_id,
      assigned_workers: job.assigned_workers,
    });

    created++;
  }

  return NextResponse.json({ ok: true, created });
}
