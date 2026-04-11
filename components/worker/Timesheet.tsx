"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/ToastContainer";

type Entry = {
  id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  notes?: string | null;
};

type Request = {
  id: string;
  time_entry_id: string | null;
  requested_date: string;
  requested_clocked_in_at: string | null;
  requested_clocked_out_at: string | null;
  reason: string;
  status: "pending" | "approved" | "declined";
  created_at: string;
};

type Props = {
  weekStart: string;
  entries: Entry[];
  requests: Request[];
};

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function hoursWorked(inAt: string, outAt: string | null) {
  if (!outAt) return null;
  return (new Date(outAt).getTime() - new Date(inAt).getTime()) / 3_600_000;
}

const STATUS_STYLES: Record<Request["status"], { bg: string; text: string }> = {
  pending:   { bg: "bg-amber/15 border-amber/40",  text: "text-amber-dark" },
  approved:  { bg: "bg-green-50 border-green-200", text: "text-green-700" },
  declined:  { bg: "bg-red-50 border-red-200",     text: "text-red-700" },
};

export default function Timesheet({ weekStart, entries, requests }: Props) {
  const { addToast } = useToast();
  const [localRequests, setLocalRequests] = useState<Request[]>(requests);
  const [modalOpen, setModalOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(weekStart);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [inTime, setInTime] = useState("");
  const [outTime, setOutTime] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const today = new Date().toISOString().split("T")[0];
  const pendingCount = localRequests.filter((r) => r.status === "pending").length;

  const entriesByDate = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    for (const e of entries) {
      const date = e.clocked_in_at.split("T")[0];
      if (!map[date]) map[date] = [];
      map[date].push(e);
    }
    return map;
  }, [entries]);

  const requestsByDate = useMemo(() => {
    const map: Record<string, Request[]> = {};
    for (const r of localRequests) {
      if (!map[r.requested_date]) map[r.requested_date] = [];
      map[r.requested_date].push(r);
    }
    return map;
  }, [localRequests]);

  // Close requests panel when navigating weeks
  useEffect(() => { setRequestsOpen(false); }, [weekStart]);

  const openModal = (date: string, entryId: string | null) => {
    setSelectedDate(date);
    setSelectedEntryId(entryId);
    setInTime("");
    setOutTime("");
    setReason("");
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    const requested_clocked_in_at = inTime ? `${selectedDate}T${inTime}:00Z` : undefined;
    const requested_clocked_out_at = outTime ? `${selectedDate}T${outTime}:00Z` : undefined;

    const res = await fetch("/api/timesheets/change-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        time_entry_id: selectedEntryId ?? undefined,
        requested_date: selectedDate,
        requested_clocked_in_at,
        requested_clocked_out_at,
        reason,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      addToast(data.error || "Failed to submit request", "error");
      setError(data.error || "Failed to submit request.");
      return;
    }

    addToast("Request submitted", "success");
    setLocalRequests((prev) => [data.request as Request, ...prev]);
    setSuccess("Request sent to your owner.");
    setModalOpen(false);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div>
          <h1 className="font-display font-800 text-2xl text-forge">My Timesheet</h1>
          <p className="text-mist text-sm">Review your week and request fixes.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/worker/timesheets?week=${prevWeek}`}
            className="p-2 rounded-lg border border-gray-200 hover:border-forge transition-colors"
            aria-label="Previous week"
          >
            <svg className="w-4 h-4 text-forge" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <span className="font-display font-700 text-forge text-base min-w-[140px] text-center">
            {fmtDate(weekStart)} – {fmtDate(addDays(weekStart, 6))}
          </span>
          <a
            href={`/worker/timesheets?week=${nextWeek}`}
            className="p-2 rounded-lg border border-gray-200 hover:border-forge transition-colors"
            aria-label="Next week"
          >
            <svg className="w-4 h-4 text-forge" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
          {weekStart !== getMonday(new Date()) && (
            <a
              href="/worker/timesheets"
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-600 text-mist hover:text-forge hover:border-forge transition-colors"
            >
              This week
            </a>
          )}
          {localRequests.length > 0 && (
            <button
              type="button"
              onClick={() => setRequestsOpen(true)}
              className="relative inline-flex items-center gap-1.5 px-3 py-2 text-sm font-600 text-forge bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              My Requests
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-800 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Request status summary */}
      {localRequests.length > 0 && (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["pending", "approved", "declined"] as Request["status"][]).map((s) => {
            const count = localRequests.filter((r) => r.status === s).length;
            if (count === 0) return null;
            const style = STATUS_STYLES[s];
            return (
              <div key={s} className={`border ${style.bg} ${style.text} rounded-lg px-3 py-2`}>
                <p className="text-[11px] uppercase tracking-wide font-700">{s}</p>
                <p className="font-display font-800 text-lg">{count}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        {days.map((date) => {
          const dayEntries = entriesByDate[date] ?? [];
          const dayRequests = requestsByDate[date] ?? [];
          const pending = dayRequests.find((r) => r.status === "pending");
          const totalHours = dayEntries.reduce((s, e) => s + (hoursWorked(e.clocked_in_at, e.clocked_out_at) ?? 0), 0);

          return (
            <div
              key={date}
              className={`bg-white border rounded-xl p-4 ${date === today ? "border-amber" : "border-gray-200"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-mist font-600">{fmtDate(date)}</p>
                  <p className="font-display font-800 text-lg text-forge">{totalHours > 0 ? `${totalHours.toFixed(1)}h` : "–"}</p>
                  {pending && <span className="text-xs text-amber font-700">Change requested ({pending.status})</span>}
                </div>
                <button
                  onClick={() => openModal(date, null)}
                  className="text-sm font-600 text-amber hover:underline"
                >
                  Request change
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {dayEntries.length === 0 ? (
                  <p className="text-xs text-mist">No punches.</p>
                ) : (
                  dayEntries.map((e) => {
                    const req = dayRequests.find((r) => r.time_entry_id === e.id);
                    const style = req ? STATUS_STYLES[req.status] : null;
                    return (
                      <div
                        key={e.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2"
                      >
                        <div>
                          <p className="font-600 text-sm text-forge">
                            {fmtTime(e.clocked_in_at)} – {e.clocked_out_at ? fmtTime(e.clocked_out_at) : "open"}
                          </p>
                          {e.notes && <p className="text-xs text-mist mt-0.5">{e.notes}</p>}
                        </div>
                        <button
                          onClick={() => openModal(date, e.id)}
                          className="text-xs font-600 text-amber hover:underline"
                        >
                          Request change
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} aria-hidden="true" />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-gray-200">
            <h2 className="font-display font-700 text-lg text-forge mb-2">Request a change</h2>
            <p className="text-xs text-mist mb-3">Sent to your owner to review.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">Clock in</label>
                  <input
                    type="time"
                    value={inTime}
                    onChange={(e) => setInTime(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">Clock out</label>
                  <input
                    type="time"
                    value={outTime}
                    onChange={(e) => setOutTime(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">What needs to change?</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Example: Forgot to clock out at 5:15 PM."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
            {success && <p className="text-xs text-green-700 mt-2">{success}</p>}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setModalOpen(false)}
                className="px-3 py-2 text-sm font-600 text-mist hover:text-forge"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saving || reason.trim().length < 5}
                className="bg-amber text-forge font-display font-700 px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-amber-dark transition-colors"
              >
                {saving ? "Sending…" : "Send to owner"}
              </button>
            </div>
          </div>
        </div>
      )}

      {requestsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setRequestsOpen(false)} aria-hidden="true" />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-700 text-lg text-forge">Requests this week</h2>
              <button onClick={() => setRequestsOpen(false)} className="text-sm text-mist hover:text-forge">Close</button>
            </div>
            {localRequests.length === 0 ? (
              <p className="text-sm text-mist">No requests this week.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-auto pr-1">
                {localRequests.map((r) => (
                  <div key={r.id} className="border border-gray-100 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-700 text-forge">{fmtDate(r.requested_date)}</p>
                      <span className={`text-[11px] font-700 px-2 py-0.5 rounded border ${STATUS_STYLES[r.status].bg} ${STATUS_STYLES[r.status].text}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-mist mt-1">
                      {r.requested_clocked_in_at ? fmtTime(r.requested_clocked_in_at) : "—"} – {r.requested_clocked_out_at ? fmtTime(r.requested_clocked_out_at) : "—"}
                    </p>
                    <p className="text-xs text-steel mt-1 leading-snug">{r.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split("T")[0];
}
