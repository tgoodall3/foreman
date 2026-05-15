import Timesheet from "@/components/worker/Timesheet";
import { requireWorker } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";

function getMondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split("T")[0];
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

export default async function WorkerTimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const profile = await requireWorker();
  const supabase = await createServerSideClient();

  const weekStart = (() => {
    const raw = week;
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return getMondayOf(new Date());
  })();
  const weekEnd  = addDays(weekStart, 6);

  const [{ data: entries }, { data: requests }] = await Promise.all([
    supabase
      .from("time_entries")
      .select("id, clocked_in_at, clocked_out_at, notes")
      .eq("worker_id", profile.id)
      .gte("clocked_in_at", weekStart + "T00:00:00Z")
      .lte("clocked_in_at", weekEnd + "T23:59:59Z")
      .order("clocked_in_at"),
    supabase
      .from("time_change_requests")
      .select("id, time_entry_id, requested_date, requested_clocked_in_at, requested_clocked_out_at, reason, status, created_at")
      .eq("worker_id", profile.id)
      .gte("requested_date", weekStart)
      .lte("requested_date", weekEnd)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <Timesheet
      weekStart={weekStart}
      entries={entries ?? []}
      requests={requests ?? []}
    />
  );
}
