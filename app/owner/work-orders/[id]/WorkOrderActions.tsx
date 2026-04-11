"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastContainer";

export default function WorkOrderActions({ workOrderId, tenantId, workOrderTitle, workOrderDescription, propertyId }: {
  workOrderId: string; tenantId: string; workOrderTitle: string; workOrderDescription: string; propertyId: string;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState("");

  const handle = async (action: "accept" | "decline") => {
    setLoading(action); setError("");
    const res = await fetch("/api/work-orders/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workOrderId, tenantId, action, title: workOrderTitle, description: workOrderDescription, propertyId }),
    });
    const data = await res.json();
    if (!res.ok) {
      addToast(data.error || "Action failed", "error");
      setError(data.error || "Action failed");
      setLoading(null);
      return;
    }

    // If accept created a job, jump straight to schedule/assign
    if (action === "accept" && data.jobId) {
      addToast("Work order accepted — job created", "success");
      router.push(`/owner/jobs/${data.jobId}/edit`);
      return;
    }

    addToast("Work order declined", "success");
    router.refresh();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-display font-700 text-lg text-forge mb-3">Take Action</h2>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={() => handle("accept")}
          disabled={!!loading}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-display font-700 py-2.5 rounded-lg text-sm transition-colors min-h-[44px] shadow-sm"
        >
          {loading === "accept" ? "Accepting…" : "✓ Accept & Create Job"}
        </button>
        <button
          onClick={() => handle("decline")}
          disabled={!!loading}
          className="px-4 py-2.5 border border-gray-300 hover:border-red-300 hover:text-red-600 disabled:opacity-50 text-mist font-display font-700 rounded-lg text-sm transition-colors min-h-[44px]"
        >
          {loading === "decline" ? "Declining…" : "Decline"}
        </button>
      </div>
      <p className="text-xs text-mist mt-2">Accepting will automatically create a job from this work order.</p>
    </div>
  );
}
