import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import TimeChangeRequests from "@/components/owner/TimeChangeRequests";

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

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function hoursWorked(inAt: string, outAt: string | null): number | null {
  if (!outAt) return null;
  return (new Date(outAt).getTime() - new Date(inAt).getTime()) / 3_600_000;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtWeekRange(start: string) {
  const end = addDays(start, 6);
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const sm = MONTH_NAMES[s.getUTCMonth()];
  const em = MONTH_NAMES[e.getUTCMonth()];
  if (sm === em) return `${sm} ${s.getUTCDate()}–${e.getUTCDate()}`;
  return `${sm} ${s.getUTCDate()} – ${em} ${e.getUTCDate()}`;
}

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  const profile  = await requireOwner();
  const supabase = await createServerSideClient();

  const today     = new Date().toISOString().split("T")[0];
  const weekStart = (() => {
    const raw = searchParams.week;
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return getMondayOf(new Date());
  })();
  const weekEnd = addDays(weekStart, 6);
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [{ data: workers }, { data: entries }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("tenant_id", profile.tenant_id)
      .eq("role", "worker")
      .eq("is_active", true)
      .order("full_name"),

    supabase
      .from("time_entries")
      .select("id, worker_id, clocked_in_at, clocked_out_at, notes")
      .eq("tenant_id", profile.tenant_id)
      .gte("clocked_in_at", weekStart + "T00:00:00Z")
      .lte("clocked_in_at", weekEnd + "T23:59:59Z")
      .order("clocked_in_at"),
  ]);

  const { data: requests } = await supabase
    .from("time_change_requests")
    .select("id, worker_id, time_entry_id, requested_date, requested_clocked_in_at, requested_clocked_out_at, reason, status, created_at, profiles!time_change_requests_worker_id_fkey(full_name)")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  // Group entries by worker_id → date
  type Entry = { id: string; worker_id: string; clocked_in_at: string; clocked_out_at: string | null; notes: string | null };
  const byWorkerDate: Record<string, Record<string, Entry[]>> = {};
  for (const e of (entries ?? []) as Entry[]) {
    const date = e.clocked_in_at.split("T")[0];
    if (!byWorkerDate[e.worker_id]) byWorkerDate[e.worker_id] = {};
    if (!byWorkerDate[e.worker_id][date]) byWorkerDate[e.worker_id][date] = [];
    byWorkerDate[e.worker_id][date].push(e);
  }

  // Weekly total per worker
  const workerTotals: Record<string, number> = {};
  for (const e of (entries ?? []) as Entry[]) {
    const h = hoursWorked(e.clocked_in_at, e.clocked_out_at);
    if (h != null) {
      workerTotals[e.worker_id] = (workerTotals[e.worker_id] ?? 0) + h;
    }
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-display font-800 text-3xl text-forge">Timesheets</h1>

        {/* Week nav */}
        <div className="flex items-center gap-2">
          <a
            href={`/owner/timesheets?week=${prevWeek}`}
            className="p-2 rounded-lg border border-gray-200 hover:border-forge transition-colors"
            aria-label="Previous week"
          >
            <svg className="w-4 h-4 text-forge" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <span className="font-display font-700 text-forge text-base min-w-[140px] text-center">
            {fmtWeekRange(weekStart)}
          </span>
          <a
            href={`/owner/timesheets?week=${nextWeek}`}
            className="p-2 rounded-lg border border-gray-200 hover:border-forge transition-colors"
            aria-label="Next week"
          >
            <svg className="w-4 h-4 text-forge" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
          {weekStart !== getMondayOf(new Date()) && (
            <a
              href="/owner/timesheets"
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-600 text-mist hover:text-forge hover:border-forge transition-colors"
            >
              This week
            </a>
          )}
        </div>
      </div>

      <div className="mb-6">
        <TimeChangeRequests
          requests={(requests ?? []).map((r: any) => ({
            ...r,
            worker_name: r.profiles?.full_name ?? "Worker",
          }))}
        />
      </div>

      {!workers?.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-mist text-sm">No active workers yet.</p>
        </div>
      ) : (
        <>
          {/* Desktop: grid table */}
          <div className="hidden lg:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider w-40">Worker</th>
                  {days.map((d, i) => (
                    <th key={d} className={`px-2 py-3 text-center font-600 text-xs uppercase tracking-wider ${d === today ? "text-amber" : "text-mist"}`}>
                      <div>{DAY_NAMES[i]}</div>
                      <div className="font-400 normal-case">{fmtDate(d)}</div>
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(workers ?? []).map((worker) => {
                  const wEntries = byWorkerDate[worker.id] ?? {};
                  const total    = workerTotals[worker.id] ?? 0;
                  const hasOpen  = (entries ?? []).some((e: any) => e.worker_id === worker.id && !e.clocked_out_at);

                  return (
                    <tr key={worker.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-steel rounded-full flex items-center justify-center shrink-0">
                            <span className="text-white text-xs font-700">{worker.full_name[0]}</span>
                          </div>
                          <div>
                            <p className="font-600 text-forge text-xs">{worker.full_name.split(" ")[0]}</p>
                            {hasOpen && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-green-700 font-600">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                In
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {days.map((d) => {
                        const dayEntries = wEntries[d] ?? [];
                        const dayHours   = dayEntries.reduce((s, e) => s + (hoursWorked(e.clocked_in_at, e.clocked_out_at) ?? 0), 0);
                        const isOpen     = dayEntries.some((e) => !e.clocked_out_at);

                        return (
                          <td key={d} className={`px-2 py-3 text-center ${d === today ? "bg-amber/5" : ""}`}>
                            {dayEntries.length === 0 ? (
                              <span className="text-gray-200">—</span>
                            ) : (
                              <div>
                                <p className={`font-700 text-sm ${isOpen ? "text-green-600" : "text-forge"}`}>
                                  {isOpen ? `${dayHours.toFixed(1)}h…` : `${dayHours.toFixed(1)}h`}
                                </p>
                                {dayEntries.map((e) => (
                                  <p key={e.id} className="text-[10px] text-mist">
                                    {fmtTime(e.clocked_in_at)}–{e.clocked_out_at ? fmtTime(e.clocked_out_at) : "now"}
                                  </p>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right">
                        <span className={`font-display font-800 text-sm ${total > 0 ? "text-forge" : "text-mist"}`}>
                          {total > 0 ? `${total.toFixed(1)}h` : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list */}
          <div className="lg:hidden space-y-4">
            {(workers ?? []).map((worker) => {
              const wEntries = byWorkerDate[worker.id] ?? {};
              const total    = workerTotals[worker.id] ?? 0;
              const hasOpen  = (entries ?? []).some((e: any) => e.worker_id === worker.id && !e.clocked_out_at);

              return (
                <div key={worker.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-steel rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-700">{worker.full_name[0]}</span>
                      </div>
                      <div>
                        <p className="font-700 text-forge text-sm">{worker.full_name}</p>
                        {hasOpen && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 font-600">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            Clocked in
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-display font-800 text-lg text-forge">
                      {total > 0 ? `${total.toFixed(1)}h` : "—"}
                    </span>
                  </div>

                  <div className="divide-y divide-gray-50">
                    {days.map((d, i) => {
                      const dayEntries = wEntries[d] ?? [];
                      if (dayEntries.length === 0) return null;
                      const dayHours = dayEntries.reduce((s, e) => s + (hoursWorked(e.clocked_in_at, e.clocked_out_at) ?? 0), 0);

                      return (
                        <div key={d} className={`px-4 py-2.5 ${d === today ? "bg-amber/5" : ""}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-600 text-mist">{DAY_NAMES[i]} {fmtDate(d)}</span>
                            <span className="text-sm font-700 text-forge">{dayHours.toFixed(1)}h</span>
                          </div>
                          {dayEntries.map((e) => (
                            <div key={e.id} className="flex items-center justify-between mt-0.5">
                              <span className="text-xs text-mist">
                                {fmtTime(e.clocked_in_at)} – {e.clocked_out_at ? fmtTime(e.clocked_out_at) : <span className="text-green-600 font-600">now</span>}
                              </span>
                              {e.notes && <span className="text-xs text-mist truncate max-w-[120px]">{e.notes}</span>}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {Object.keys(wEntries).length === 0 && (
                      <p className="px-4 py-3 text-xs text-mist">No entries this week</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
