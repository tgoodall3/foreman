"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastContainer";

interface Props {
  workOrderId: string;
  tenantId: string;
  title: string;
  description: string;
  propertyId: string;
}

export default function WorkOrderInlineActions({ workOrderId, tenantId, title, description, propertyId }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
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
      addToast(data.error || "Action failed", "error");
      setError(data.error || "Action failed");
      setLoading(null);
      return;
    }
    if (action === "accept" && data.jobId) {
      addToast("Work order accepted — job created", "success");
      router.push(`/owner/jobs/${data.jobId}/edit`);
      return;
    }
    addToast("Work order declined", "success");
    router.refresh();
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex w-full gap-2">
        <button
          onClick={() => handle("accept")}
          disabled={!!loading}
          className="flex-1 rounded-lg bg-amber px-3 py-2.5 text-sm font-700 text-forge shadow-sm transition-colors hover:bg-amber-dark disabled:opacity-60"
        >
          {loading === "accept" ? "Accepting…" : "Accept"}
        </button>
        <button
          onClick={() => handle("decline")}
          disabled={!!loading}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-700 text-steel transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-60"
        >
          {loading === "decline" ? "Declining…" : "Decline"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
