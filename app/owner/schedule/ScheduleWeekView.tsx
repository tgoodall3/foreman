"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { JOB_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  title: string;
  status: string;
  priority: string;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  estimated_hours?: number | null;
  assigned_workers?: string[];
  properties?: { name: string; city: string; state: string } | null;
}

interface DayBucket {
  date: string;   // YYYY-MM-DD
  jobs: Job[];
}

interface Props {
  days: DayBucket[];
  unscheduled: Job[];
  workerMap: Record<string, string>;
  weekStart: string;   // YYYY-MM-DD (Monday)
  today: string;       // YYYY-MM-DD
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split("T")[0];
}

function fmtShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function fmtWeekRange(start: string): string {
  const end = addDays(start, 6);
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const sm = MONTH_NAMES[s.getUTCMonth()];
  const em = MONTH_NAMES[e.getUTCMonth()];
  if (sm === em) return `${sm} ${s.getUTCDate()}–${e.getUTCDate()}`;
  return `${sm} ${s.getUTCDate()} – ${em} ${e.getUTCDate()}`;
}

function fmtTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${suffix}`;
}

// Status transitions available to the owner from the schedule
const STATUS_TRANSITIONS: Record<string, { label: string; next: string; color: string }> = {
  pending:     { label: "Start Job",      next: "in_progress", color: "bg-amber hover:bg-amber-dark text-forge" },
  scheduled:   { label: "Start Job",      next: "in_progress", color: "bg-amber hover:bg-amber-dark text-forge" },
  in_progress: { label: "Mark Complete",  next: "completed",   color: "bg-green-600 hover:bg-green-700 text-white" },
};

// ─── Action Sheet ─────────────────────────────────────────────────────────────

function JobActionSheet({
  job,
  workerMap,
  onClose,
  onSaved,
}: {
  job: Job;
  workerMap: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();

  const statusCfg   = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG]
    ?? { label: job.status, bg: "bg-gray-100", color: "text-gray-600" };
  const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG]
    ?? { label: job.priority, bg: "bg-gray-100", color: "text-gray-600" };

  const prop = Array.isArray(job.properties) ? job.properties[0] : job.properties;
  const transition = STATUS_TRANSITIONS[job.status];

  // Reschedule form state
  const [rescheduleDate, setRescheduleDate] = useState(job.scheduled_date ?? "");
  const [rescheduleTime, setRescheduleTime] = useState(job.scheduled_time ?? "");
  const [savingReschedule, setSavingReschedule] = useState(false);

  // Worker assignment state
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>(job.assigned_workers ?? []);
  const [savingWorkers, setSavingWorkers] = useState(false);

  // Status transition
  const [savingStatus, setSavingStatus] = useState(false);

  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const workerList = Object.entries(workerMap).map(([id, name]) => ({ id, name }));

  const toggleWorker = (id: string) => {
    setSelectedWorkers((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );
  };

  const saveWorkers = async () => {
    setSavingWorkers(true);
    setError("");
    const { error: err } = await supabase
      .from("jobs")
      .update({ assigned_workers: selectedWorkers, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    setSavingWorkers(false);
    if (err) { setError("Failed to update workers."); return; }
    setSaved("Workers updated");
    setTimeout(() => { setSaved(""); onSaved(); }, 800);
  };

  const saveReschedule = async () => {
    if (!rescheduleDate) { setError("Date is required."); return; }
    setSavingReschedule(true);
    setError("");
    const { error: err } = await supabase
      .from("jobs")
      .update({
        scheduled_date: rescheduleDate,
        scheduled_time: rescheduleTime || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    setSavingReschedule(false);
    if (err) { setError("Failed to reschedule."); return; }
    setSaved("Rescheduled");
    setTimeout(() => { setSaved(""); onSaved(); }, 800);
  };

  const advanceStatus = async () => {
    if (!transition) return;
    setSavingStatus(true);
    setError("");
    const { error: err } = await supabase
      .from("jobs")
      .update({ status: transition.next, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    setSavingStatus(false);
    if (err) { setError("Failed to update status."); return; }

    // Fire notifications on completion (best-effort)
    if (transition.next === "completed") {
      fetch("/api/jobs/notify-completed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
    }

    setSaved(transition.next === "completed" ? "Marked complete!" : "Job started");
    setTimeout(() => { setSaved(""); onSaved(); }, 800);
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-sheet-title"
    >
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="min-w-0 pr-3">
            <h2 id="action-sheet-title" className="font-display font-800 text-lg text-forge leading-snug">
              {job.title}
            </h2>
            {prop && (
              <p className="text-xs text-mist mt-0.5 truncate">{prop.name} · {prop.city}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
              <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
              {job.scheduled_date && (
                <span className="text-xs text-mist">{fmtShort(job.scheduled_date)}</span>
              )}
              {job.scheduled_time && (
                <span className="text-xs text-mist">{fmtTime(job.scheduled_time)}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-mist" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {/* Status action */}
          {transition && (
            <div className="px-5 py-4 border-b border-gray-100">
              <button
                onClick={advanceStatus}
                disabled={savingStatus || !!saved}
                className={`w-full font-display font-700 py-3 rounded-xl text-sm transition-colors disabled:opacity-50 ${transition.color}`}
              >
                {savingStatus ? "Updating…" : transition.label}
              </button>
            </div>
          )}

          {/* Worker assignment */}
          {workerList.length > 0 && (
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs font-700 text-mist uppercase tracking-wider mb-3">Assigned Workers</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {workerList.map(({ id, name }) => {
                  const active = selectedWorkers.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleWorker(id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-600 border transition-all ${
                        active
                          ? "bg-forge text-white border-forge"
                          : "bg-white text-steel border-gray-200 hover:border-forge"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-800 ${
                          active ? "bg-white/20 text-white" : "bg-steel/20 text-steel"
                        }`}
                      >
                        {name[0]}
                      </span>
                      {name.split(" ")[0]}
                      {active && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={saveWorkers}
                disabled={savingWorkers || !!saved}
                className="w-full border border-gray-200 hover:border-forge rounded-lg py-2 text-sm font-600 text-forge transition-colors disabled:opacity-50"
              >
                {savingWorkers ? "Saving…" : "Save Assignment"}
              </button>
            </div>
          )}

          {/* Reschedule */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-700 text-mist uppercase tracking-wider mb-3">Reschedule</p>
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className="block text-xs text-mist mb-1">Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-mist mb-1">Time (optional)</label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber"
                />
              </div>
            </div>
            <button
              onClick={saveReschedule}
              disabled={savingReschedule || !!saved}
              className="w-full border border-gray-200 hover:border-forge rounded-lg py-2 text-sm font-600 text-forge transition-colors disabled:opacity-50"
            >
              {savingReschedule ? "Saving…" : "Save Schedule"}
            </button>
          </div>

          {/* Feedback / errors */}
          {error && (
            <div className="mx-5 mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {saved && (
            <div className="mx-5 mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 font-600">
              ✓ {saved}
            </div>
          )}

          {/* Full detail link */}
          <div className="px-5 py-4">
            <Link
              href={`/owner/jobs/${job.id}`}
              className="block text-center text-sm text-amber hover:underline font-600"
            >
              View full details →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Status left-border colours ───────────────────────────────────────────────

const STATUS_BORDER: Record<string, string> = {
  pending:     "border-l-yellow-400",
  scheduled:   "border-l-blue-400",
  in_progress: "border-l-amber",
  completed:   "border-l-green-500",
  invoiced:    "border-l-purple-400",
  cancelled:   "border-l-gray-300",
};

// ─── Job Card — compact for narrow calendar columns ───────────────────────────

function JobCard({
  job,
  workerMap,
  onClick,
}: {
  job: Job;
  workerMap: Record<string, string>;
  onClick: () => void;
}) {
  const border = STATUS_BORDER[job.status] ?? "border-l-gray-300";

  const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG]
    ?? { label: job.priority, bg: "bg-gray-100", color: "text-gray-600" };

  const initials = (job.assigned_workers ?? [])
    .map((id) => workerMap[id]?.[0])
    .filter(Boolean)
    .slice(0, 3);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border border-gray-200 border-l-4 ${border} rounded-lg px-2 py-1.5 hover:bg-amber/5 hover:border-amber hover:border-l-amber transition-all group`}
    >
      {/* Time row */}
      {job.scheduled_time && (
        <p className="text-[10px] text-mist mb-0.5 tabular-nums">{fmtTime(job.scheduled_time)}</p>
      )}

      {/* Title */}
      <p className="font-600 text-forge text-xs leading-snug group-hover:text-amber transition-colors line-clamp-2">
        {job.title}
      </p>

      {/* Worker initials */}
      {initials.length > 0 && (
        <div className="flex gap-0.5 mt-1">
          {initials.map((letter, i) => (
            <span
              key={i}
              className="w-4 h-4 bg-steel/20 text-steel rounded-full flex items-center justify-center text-[9px] font-800"
            >
              {letter}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScheduleWeekView({ days, unscheduled, workerMap, weekStart, today, hasError }: Props) {
  const router = useRouter();
  const [activeJob, setActiveJob] = useState<Job | null>(null);

  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const thisWeek = getMondayOf(today);
  const isCurrentWeek = weekStart === thisWeek;

  const totalScheduled = days.reduce((sum, d) => sum + d.jobs.length, 0);

  const handleSaved = () => {
    setActiveJob(null);
    router.refresh();
  };

  if (hasError) {
    return (
      <div className="p-6 max-w-5xl">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700 font-700">Unable to load schedule right now.</p>
          <p className="text-xs text-red-700">Refresh to retry; we hit a temporary data error.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-800 text-3xl text-forge">Schedule</h1>
          <p className="text-mist text-sm mt-0.5">
            {totalScheduled} job{totalScheduled !== 1 ? "s" : ""} this week
            {unscheduled.length > 0 && ` · ${unscheduled.length} unscheduled`}
          </p>
        </div>
        <Link
          href="/owner/jobs/new"
          className="bg-amber hover:bg-amber-dark text-forge font-display font-700 px-4 py-2.5 rounded-lg text-sm transition-colors min-h-[44px] flex items-center"
        >
          + New Job
        </Link>
      </div>

      {/* ── Week navigation ── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push(`/owner/schedule?week=${prevWeek}`)}
          className="p-2 rounded-lg border border-gray-200 hover:border-forge hover:bg-gray-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Previous week"
        >
          <svg className="w-4 h-4 text-forge" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 text-center">
          <span className="font-display font-700 text-forge text-lg">{fmtWeekRange(weekStart)}</span>
        </div>

        <button
          onClick={() => router.push(`/owner/schedule?week=${nextWeek}`)}
          className="p-2 rounded-lg border border-gray-200 hover:border-forge hover:bg-gray-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Next week"
        >
          <svg className="w-4 h-4 text-forge" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {!isCurrentWeek && (
          <button
            onClick={() => router.push(`/owner/schedule?week=${thisWeek}`)}
            className="px-3 py-2 rounded-lg border border-gray-200 hover:border-forge text-sm font-600 text-mist hover:text-forge transition-colors min-h-[44px]"
          >
            Today
          </button>
        )}
      </div>

      {/* ── Day columns ── */}
      <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-7 lg:gap-3 overflow-x-auto pb-2">
        {days.map(({ date, jobs }, i) => {
          const isToday  = date === today;
          const dayNum   = new Date(date + "T00:00:00Z").getUTCDate();
          const isWeekend = i >= 5;

          return (
            <div
              key={date}
              className={`min-w-[220px] rounded-xl border ${
                isToday
                  ? "border-amber bg-amber/5"
                  : isWeekend
                  ? "border-gray-100 bg-gray-50/50"
                  : "border-gray-200 bg-white"
              }`}
            >
              {/* Day header */}
              <div
                className={`flex items-center justify-between px-3 py-2 border-b ${
                  isToday ? "border-amber/30" : "border-gray-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-display font-700 text-sm ${
                      isToday ? "text-amber" : isWeekend ? "text-mist" : "text-forge"
                    }`}
                  >
                    {DAY_NAMES[i]}
                  </span>
                  <span
                    className={
                      isToday
                        ? "w-6 h-6 bg-amber text-forge font-700 rounded-full flex items-center justify-center text-xs"
                        : "text-sm text-mist"
                    }
                  >
                    {dayNum}
                  </span>
                  {isToday && (
                    <span className="text-xs font-600 text-amber hidden lg:inline">Today</span>
                  )}
                </div>
                <Link
                  href={`/owner/jobs/new?date=${date}`}
                  className="text-mist hover:text-amber transition-colors"
                  aria-label={`Add job on ${date}`}
                  title="Add job"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </Link>
              </div>

              {/* Jobs */}
              <div className="p-1.5 space-y-1 min-h-[48px]">
                {jobs.length === 0 ? (
                  <p className="text-[10px] text-mist/40 text-center py-2 hidden lg:block">—</p>
                ) : (
                  jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      workerMap={workerMap}
                      onClick={() => setActiveJob(job)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Unscheduled jobs ── */}
      {unscheduled.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-700 text-lg text-forge">
              Unscheduled
              <span className="ml-2 text-sm font-500 text-mist">({unscheduled.length})</span>
            </h2>
            <Link href="/owner/jobs?status=pending" className="text-xs text-amber hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {unscheduled.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                workerMap={workerMap}
                onClick={() => setActiveJob(job)}
              />
            ))}
          </div>
        </section>
      )}

      {totalScheduled === 0 && unscheduled.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-display font-700 text-xl text-forge">Nothing scheduled</p>
          <p className="text-mist text-sm mt-1 mb-4">This week is wide open.</p>
          <Link
            href="/owner/jobs/new"
            className="bg-amber hover:bg-amber-dark text-forge font-display font-700 px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            Create a Job
          </Link>
        </div>
      )}

      {/* ── Action Sheet ── */}
      {activeJob && (
        <JobActionSheet
          job={activeJob}
          workerMap={workerMap}
          onClose={() => setActiveJob(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
