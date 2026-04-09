"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  workOrderId: string;
  tenantId: string;
  title: string;
  description: string;
  propertyId: string;
}

export default function WorkOrderInlineActions({ workOrderId, tenantId, title, description, propertyId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string>("");

  const handle = async (action: "accept" | "decline") => {
    setLoading(action); setError("");
    const res = await fetch("/api/work-orders/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workOrderId, tenantId, action, title, description, propertyId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Action failed");
      setLoading(null);
      return;
    }
    if (action === "accept" && data.jobId) {
      router.push(`/owner/jobs/${data.jobId}/edit`);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex gap-2 w-full">
      <button
        onClick={() => handle("accept")}
        disabled={!!loading}
        className="flex-1 bg-amber text-forge font-700 text-xs px-3 py-2 rounded-lg hover:bg-amber-dark transition-colors disabled:opacity-60 shadow-sm"
      >
        {loading === "accept" ? "Accepting…" : "Accept"}
      </button>
      <button
        onClick={() => handle("decline")}
        disabled={!!loading}
        className="px-3 py-2 border border-gray-300 text-xs text-steel rounded-lg hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-60"
      >
        {loading === "decline" ? "Declining…" : "Decline"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
