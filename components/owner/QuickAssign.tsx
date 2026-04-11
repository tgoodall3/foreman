"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastContainer";

interface Props {
  jobId: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  assignedWorkers?: string[] | null;
  workers: { id: string; full_name: string }[];
}

export default function QuickAssign({ jobId, scheduledDate, scheduledTime, assignedWorkers, workers }: Props) {
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const nextSlot = () => {
    const d = new Date();
    const minutes = d.getMinutes();
    const rounded = minutes < 30 ? 30 : 60;
    d.setMinutes(rounded, 0, 0);
    return {
      date: d.toISOString().slice(0, 10),
      time: d.toTimeString().slice(0, 5),
    };
  };
  const defaultSlot = nextSlot();
  const [date, setDate] = useState(scheduledDate || defaultSlot.date);
  const [time, setTime] = useState(scheduledTime || defaultSlot.time);
  const [selected, setSelected] = useState<string[]>(assignedWorkers || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [checking, setChecking] = useState(false);

  const toggleWorker = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]);
  };

  useEffect(() => {
    const fetchConflicts = async () => {
      if (!open || !date || !time || selected.length === 0) {
        setConflicts([]);
        return;
      }
      setChecking(true);
      try {
        const res = await fetch("/api/jobs/conflicts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduled_date: date, scheduled_time: time, worker_ids: selected }),
        });
        const data = await res.json();
        setConflicts(data.conflicts || []);
      } catch {
        setConflicts([]);
      } finally {
        setChecking(false);
      }
    };
    fetchConflicts();
  }, [open, date, time, selected]);

  const submit = async () => {
    setLoading(true); setError("");
    const payload = { scheduled_date: date || null, scheduled_time: time || null, assigned_workers: selected };
    const res = await fetch(`/api/jobs/${jobId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      addToast(data.error || "Failed to update job", "error");
      setError(data.error || "Failed to update job");
      setLoading(false);
      return;
    }
    // fire-and-forget notify if we have assignees
    if (selected.length > 0) {
      fetch("/api/jobs/notify-assigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, workerIds: selected }),
      }).catch(() => {});
    }
    addToast("Job updated", "success");
    setLoading(false);
    setOpen(false);
    location.reload();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-700 text-forge bg-amber/80 hover:bg-amber text-forge px-3 py-1.5 rounded-lg transition-colors shadow-sm"
      >
        Assign / Reschedule
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true">
          <div className="bg-white w-full sm:max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <p className="text-xs uppercase tracking-wider text-mist font-700">Assign / Reschedule</p>
                <p className="text-sm text-forge font-700">{date || "No date set"} {time && `· ${time}`}</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
                <svg className="w-4 h-4 text-mist" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-mist block mb-1">Date</label>
                  <input
                    type="date"
                    value={date || ""}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs text-mist block mb-1">Time</label>
                  <input
                    type="time"
                    value={time || ""}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs text-mist mb-1">Assign workers</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {workers.map((w) => {
                    const active = selected.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => toggleWorker(w.id)}
                        className={`w-full text-left text-sm px-2 py-1.5 rounded-lg border flex items-center justify-between ${active ? "border-amber bg-amber/10 text-forge" : "border-gray-200 text-steel hover:border-amber"}`}
                      >
                        {w.full_name}
                        {active && <span className="text-[10px] text-amber-800 font-700">Selected</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {checking && <p className="text-xs text-mist">Checking conflicts…</p>}
              {conflicts.length > 0 && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                  <p className="font-700 mb-1">Conflict</p>
                  {conflicts.map((c: any) => (
                    <p key={c.id} className="line-clamp-1">• {c.title} at {c.scheduled_time}</p>
                  ))}
                </div>
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>

            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-xs font-600 text-mist hover:text-forge"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-700 bg-forge text-white rounded-lg disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
