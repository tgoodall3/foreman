"use client";

import { useState } from "react";

type Request = {
  id: string;
  worker_id: string;
  worker_name: string;
  requested_date: string;
  requested_clocked_in_at: string | null;
  requested_clocked_out_at: string | null;
  time_entry_id: string | null;
  reason: string;
  status: "pending" | "approved" | "declined";
  created_at: string;
};

type Props = { requests: Request[] };

const ARCHIVE_DAYS = 7;

function isArchived(r: Request) {
  if (r.status === "pending") return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ARCHIVE_DAYS);
  return new Date(r.created_at) < cutoff;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function TimeChangeRequests({ requests }: Props) {
  const [items, setItems] = useState<Request[]>(requests);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showPast, setShowPast] = useState(false);

  const active   = items.filter((r) => !isArchived(r));
  const archived = items.filter((r) => isArchived(r));
  const visible  = showPast ? archived : active;

  const handle = async (id: string, action: "approve" | "decline") => {
    setLoadingId(id);
    setError("");
    const res = await fetch(`/api/timesheets/change-request/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setLoadingId(null);
    if (!res.ok) {
      setError(data.error || "Failed to update request.");
      return;
    }
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, status: data.request.status } : r)));
  };

  const pendingCount = active.filter((r) => r.status === "pending").length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="font-600 text-forge text-sm">Change Requests</p>
          {pendingCount > 0 && (
            <span className="bg-amber/20 text-amber-dark text-xs font-700 px-2 py-0.5 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        {archived.length > 0 && (
          <button
            onClick={() => setShowPast((v) => !v)}
            className="text-xs text-mist hover:text-forge transition-colors font-500"
          >
            {showPast ? "Hide past" : `Show past (${archived.length})`}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {visible.length === 0 ? (
        <p className="text-xs text-mist">
          {showPast ? "No past requests." : "Nothing to review."}
        </p>
      ) : (
        <div className="space-y-3 max-h-[520px] overflow-auto pr-1">
          {visible.map((r) => (
            <div key={r.id} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-700 text-forge">{r.worker_name}</p>
                  <p className="text-xs text-mist">{fmtDate(r.requested_date)}</p>
                </div>
                <span className={`text-xs font-700 px-2 py-1 rounded ${
                  r.status === "pending" ? "bg-amber/20 text-amber-dark"
                  : r.status === "approved" ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
                }`}>
                  {r.status}
                </span>
              </div>

              <p className="text-xs text-forge mt-2">
                {fmtTime(r.requested_clocked_in_at)} – {fmtTime(r.requested_clocked_out_at)}
                {r.time_entry_id ? " (existing entry)" : " (new entry)"}
              </p>
              <p className="text-xs text-mist mt-1 leading-snug">{r.reason}</p>

              {r.status === "pending" && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handle(r.id, "decline")}
                    disabled={loadingId === r.id}
                    className="flex-1 border border-gray-200 text-forge text-sm font-600 rounded-lg py-2 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handle(r.id, "approve")}
                    disabled={loadingId === r.id}
                    className="flex-1 bg-forge text-white text-sm font-700 rounded-lg py-2 hover:bg-forge-dark disabled:opacity-50"
                  >
                    {loadingId === r.id ? "Saving…" : "Approve"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
