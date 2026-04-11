"use client";

import { useEffect, useState, useRef } from "react";
import { useToast } from "@/components/ui/ToastContainer";

interface TimeEntry {
  id: string;
  clocked_in_at: string;
}

function elapsed(since: string): string {
  const secs = Math.floor((Date.now() - new Date(since).getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export default function ClockWidget() {
  const { addToast } = useToast();
  const [entry, setEntry]       = useState<TimeEntry | null | undefined>(undefined); // undefined = loading
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [notes, setNotes]       = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [tick, setTick]         = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch current status on mount
  useEffect(() => {
    fetch("/api/timesheets/status")
      .then((r) => r.json())
      .then((d) => setEntry(d.entry))
      .catch(() => setEntry(null));
  }, []);

  // Live timer when clocked in
  useEffect(() => {
    if (entry) {
      timerRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [entry]);

  const clockIn = async () => {
    setSaving(true); setError("");
    const res = await fetch("/api/timesheets/clock-in", { method: "POST" });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { addToast(data.error || "Failed to clock in", "error"); setError(data.error || "Failed to clock in."); return; }
    addToast("Clocked in", "success");
    setEntry(data.entry);
  };

  const clockOut = async () => {
    setSaving(true); setError("");
    const res = await fetch("/api/timesheets/clock-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes.trim() || undefined }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { addToast(data.error || "Failed to clock out", "error"); setError(data.error || "Failed to clock out."); return; }
    addToast("Clocked out", "success");
    setEntry(null);
    setNotes("");
    setShowNotes(false);
  };

  // Loading state
  if (entry === undefined) {
    return <div className="h-16 bg-white rounded-xl border border-gray-200 animate-pulse mb-4" />;
  }

  // Clocked in
  if (entry) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <p className="text-sm font-700 text-green-800">Clocked In</p>
            </div>
            <p className="font-display font-800 text-2xl text-green-900 mt-0.5 tabular-nums">
              {elapsed(entry.clocked_in_at)}
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              Since {new Date(entry.clocked_in_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          <button
            onClick={() => setShowNotes((v) => !v)}
            disabled={saving}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-display font-700 px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            Clock Out
          </button>
        </div>

        {showNotes && (
          <div className="mt-3 pt-3 border-t border-green-200">
            <label className="block text-xs font-700 text-green-800 uppercase tracking-wider mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="What did you work on today?"
              className="w-full border border-green-200 bg-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-green-400"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setShowNotes(false)}
                className="flex-1 border border-green-200 text-green-800 rounded-lg py-2 text-sm font-600 hover:bg-green-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={clockOut}
                disabled={saving}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-display font-700 py-2 rounded-lg text-sm transition-colors"
              >
                {saving ? "Clocking out…" : "Confirm Clock Out"}
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    );
  }

  // Not clocked in
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-700 text-forge">Not clocked in</p>
          <p className="text-xs text-mist mt-0.5">Tap to start your shift</p>
        </div>
        <button
          onClick={clockIn}
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-display font-700 px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          {saving ? "Clocking in…" : "Clock In"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
