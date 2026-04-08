"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

/** Format YYYY-MM-DD → "Apr 7" */
function fmtShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Format YYYY-MM-DD week range → "Apr 7–13" or "Mar 31 – Apr 6" */
function fmtWeekRange(start: string): string {
  const end = addDays(start, 6);
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const sm = MONTH_NAMES[s.getUTCMonth()];
  const em = MONTH_NAMES[e.getUTCMonth()];
  if (sm === em) return `${sm} ${s.getUTCDate()}–${e.getUTCDate()}`;
  return `${sm} ${s.getUTCDate()} – ${em} ${e.getUTCDate()}`;
}

/** Format 24h "HH:MM" → "9:00 AM" */
function fmtTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${suffix}`;
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({ job, workerMap }: { job: Job; workerMap: Record<string, string> }) {
  const statusCfg  = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG]
    ?? { label: job.status, bg: "bg-gray-100", color: "text-gray-600" };
  const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG]
    ?? { label: job.priority, bg: "bg-gray-100", color: "text-gray-600" };

  // Supabase may return the joined row as an object or a single-element array
  const prop = Array.isArray(job.properties) ? job.properties[0] : job.properties;

  const assignedNames = (job.assigned_workers ?? [])
    .map((id) => workerMap[id])
    .filter(Boolean);

  return (
    <Link
      href={`/owner/jobs/${job.id}`}
      className="block bg-white border border-gray-200 rounded-xl p-3 hover:border-amber hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-600 text-forge text-sm leading-snug group-hover:text-amber transition-colors line-clamp-2">
          {job.title}
        </span>
        <span className={`badge shrink-0 ${priorityCfg.bg} ${priorityCfg.color} text-xs`}>
          {priorityCfg.label}
        </span>
      </div>

      {prop && (
        <p className="text-xs text-mist mb-1.5 truncate">
          {prop.name} · {prop.city}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`badge text-xs ${statusCfg.bg} ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
        {job.scheduled_time && (
          <span className="text-xs text-mist">{fmtTime(job.scheduled_time)}</span>
        )}
        {job.estimated_hours != null && (
          <span className="text-xs text-mist">{job.estimated_hours}h</span>
        )}
      </div>

      {assignedNames.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {assignedNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 text-xs bg-steel/10 text-steel rounded-full px-2 py-0.5"
            >
              <span className="w-4 h-4 bg-steel rounded-full flex items-center justify-center text-white text-[10px] font-700">
                {name[0]}
              </span>
              {name.split(" ")[0]}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScheduleWeekView({ days, unscheduled, workerMap, weekStart, today }: Props) {
  const router = useRouter();
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const thisWeek = getMondayOf(today);
  const isCurrentWeek = weekStart === thisWeek;

  const totalScheduled = days.reduce((sum, d) => sum + d.jobs.length, 0);

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
      {/* Mobile: stacked vertically. Desktop: 7-column grid */}
      <div className="space-y-3 lg:grid lg:grid-cols-7 lg:gap-3 lg:space-y-0">
        {days.map(({ date, jobs }, i) => {
          const isToday = date === today;
          const dayNum  = new Date(date + "T00:00:00Z").getUTCDate();
          const isWeekend = i >= 5; // Sat/Sun

          return (
            <div
              key={date}
              className={`rounded-xl border ${
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
                    className={`text-sm ${
                      isToday
                        ? "w-6 h-6 bg-amber text-forge font-700 rounded-full flex items-center justify-center text-xs"
                        : "text-mist"
                    }`}
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
              <div className="p-2 space-y-2 min-h-[60px]">
                {jobs.length === 0 ? (
                  <p className="text-xs text-mist/60 text-center py-3 hidden lg:block">—</p>
                ) : (
                  jobs.map((job) => (
                    <JobCard key={job.id} job={job} workerMap={workerMap} />
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
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unscheduled.map((job) => (
              <JobCard key={job.id} job={job} workerMap={workerMap} />
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
    </div>
  );
}
