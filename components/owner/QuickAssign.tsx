"use client";

import { useState, useEffect } from "react";

interface Props {
  jobId: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  assignedWorkers?: string[] | null;
  workers: { id: string; full_name: string }[];
}

export default function QuickAssign({ jobId, scheduledDate, scheduledTime, assignedWorkers, workers }: Props) {
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
    const res = await fetch(`/api/jobs/${jobId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduled_date: date || null, scheduled_time: time || null, assigned_workers: selected }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update job");
      setLoading(false);
      return;
    }
    setLoading(false);
    setOpen(false);
    // soft refresh
    location.reload();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-700 text-forge bg-amber/80 hover:bg-amber text-forge px-3 py-1.5 rounded-lg transition-colors shadow-sm"
      >
        {open ? "Close" : "Assign / Reschedule"}
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-3 space-y-3">
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
          <div>
            <p className="text-xs text-mist mb-1">Assign workers</p>
            <div className="max-h-28 overflow-y-auto space-y-1">
              {workers.map((w) => {
                const active = selected.includes(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleWorker(w.id)}
                    className={`w-full text-left text-sm px-2 py-1 rounded-lg border ${active ? "border-amber bg-amber/10 text-forge" : "border-gray-200 text-steel hover:border-amber"}`}
                  >
                    {w.full_name}
                  </button>
                );
              })}
            </div>
          </div>
          {checking ? (
            <p className="text-xs text-mist">Checking conflicts…</p>
          ) : conflicts.length > 0 ? (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
              <p className="font-700 mb-1">Conflict</p>
              {conflicts.map((c: any) => (
                <p key={c.id} className="line-clamp-1">• {c.title} at {c.scheduled_time}</p>
              ))}
            </div>
          ) : null}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="w-full bg-forge text-white text-sm font-700 py-2 rounded-lg hover:bg-forge-light transition-colors disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
