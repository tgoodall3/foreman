"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const transitions: Record<string, { label: string; next: string }[]> = {
  pending: [
    { label: "Start Job", next: "in_progress" },
    { label: "Complete", next: "completed" },
  ],
  scheduled: [
    { label: "Start Job", next: "in_progress" },
    { label: "Complete", next: "completed" },
  ],
  in_progress: [{ label: "Mark Complete", next: "completed" }],
};

export default function JobStatusActions({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const options = transitions[status] || [];
  if (!options.length) return null;

  const updateStatus = async (next: string) => {
    setUpdating(true);
    setError("");
    const { error: err } = await supabase
      .from("jobs")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    if (err) {
      setError("Failed to update status");
      setUpdating(false);
      return;
    }
    if (next === "completed") {
      fetch("/api/jobs/notify-completed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      }).catch(() => {});
    }
    router.refresh();
    setUpdating(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <p className="text-xs uppercase tracking-wider text-mist font-600">Status actions</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.next}
            onClick={() => updateStatus(opt.next)}
            disabled={updating}
            className="px-3 py-2 rounded-lg text-sm font-700 bg-amber text-forge hover:bg-amber-dark disabled:opacity-50"
          >
            {updating ? "Updating…" : opt.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
