import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import ScheduleWeekView from "./ScheduleWeekView";

export const dynamic = "force-dynamic";

/** Return the ISO date string (YYYY-MM-DD) for the Monday of the week containing `date`. */
function getMondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split("T")[0];
}

/** Add `n` days to a YYYY-MM-DD string. */
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  // Determine the Monday of the requested week (default: current week)
  const today = new Date().toISOString().split("T")[0];
  const weekStart = (() => {
    const raw = searchParams.week;
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return getMondayOf(new Date());
  })();
  const weekEnd = addDays(weekStart, 6); // Sunday

  // Fetch all jobs in this week (scheduled) + unscheduled
  const [
    { data: weekJobs, error: weekErr },
    { data: unscheduled, error: unscheduledErr },
    { data: workers, error: workersErr },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, status, priority, scheduled_date, scheduled_time, estimated_hours, assigned_workers, properties(name, city, state)")
      .eq("tenant_id", profile.tenant_id)
      .gte("scheduled_date", weekStart)
      .lte("scheduled_date", weekEnd)
      .not("status", "eq", "cancelled")
      .order("scheduled_time", { ascending: true, nullsFirst: false }),

    supabase
      .from("jobs")
      .select("id, title, status, priority, assigned_workers, properties(name, city, state)")
      .eq("tenant_id", profile.tenant_id)
      .is("scheduled_date", null)
      .not("status", "in", '("completed","invoiced","cancelled")')
      .order("created_at", { ascending: false })
      .limit(20),

    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("tenant_id", profile.tenant_id)
      .eq("role", "worker")
      .eq("is_active", true),
  ]);

  const hasError = weekErr || unscheduledErr || workersErr;

  // Build worker map for fast lookup
  const workerMap: Record<string, string> = {};
  for (const w of workers ?? []) workerMap[w.id] = w.full_name;

  // Build array of 7 day buckets
  const days = Array.from({ length: 7 }, (_, i) => {
    const dateStr = addDays(weekStart, i);
    return {
      date: dateStr,
      jobs: (weekJobs ?? []).filter((j) => j.scheduled_date === dateStr),
    };
  });

  return (
    <ScheduleWeekView
      days={days as any}
      unscheduled={(unscheduled ?? []) as any}
      workerMap={workerMap}
      weekStart={weekStart}
      today={today}
      hasError={!!hasError}
    />
  );
}
