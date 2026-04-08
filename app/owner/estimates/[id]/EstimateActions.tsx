"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  estimateId: string;
  status: string;
  jobId: string | null;
}

export default function EstimateActions({ estimateId, status, jobId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState("");

  const doAction = async (action: string, method: string, url: string, body?: object) => {
    setLoading(action); setError("");
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) { setError(data.error || "Something went wrong"); return; }
    if (action === "convert" && data.jobId) {
      router.push(`/owner/jobs/${data.jobId}`);
    } else {
      router.refresh();
    }
  };

  const send    = () => doAction("send",    "POST",  `/api/estimates/${estimateId}/send`);
  const approve = () => doAction("approve", "PATCH", `/api/estimates/${estimateId}/status`, { status: "approved" });
  const decline = () => doAction("decline", "PATCH", `/api/estimates/${estimateId}/status`, { status: "declined" });
  const convert = () => doAction("convert", "POST",  `/api/estimates/${estimateId}/convert`);

  const btn = (label: string, action: string, onClick: () => void, style: string) => (
    <button
      key={action}
      onClick={onClick}
      disabled={loading !== null}
      className={`px-4 py-2 rounded-lg text-sm font-display font-700 transition-colors min-h-[44px] disabled:opacity-50 ${style}`}
    >
      {loading === action ? "…" : label}
    </button>
  );

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex flex-wrap gap-2 justify-end">
        {status === "converted" && jobId && (
          <Link href={`/owner/jobs/${jobId}`} className="px-4 py-2 rounded-lg text-sm font-display font-700 bg-green-600 text-white hover:bg-green-700 transition-colors min-h-[44px] flex items-center">
            View Job
          </Link>
        )}

        {status !== "converted" && status !== "declined" && (
          <>
            {(status === "draft" || status === "sent") &&
              btn("Send to Client", "send", send, "bg-forge hover:bg-forge-light text-white")}

            {(status === "sent" || status === "draft") && (
              <>
                {btn("Mark Approved", "approve", approve, "bg-green-600 hover:bg-green-700 text-white")}
                {btn("Mark Declined", "decline", decline, "border border-red-300 text-red-600 hover:bg-red-50")}
              </>
            )}

            {status === "approved" &&
              btn("Convert to Job →", "convert", convert, "bg-amber hover:bg-amber-dark text-forge")}
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
          {error}
        </p>
      )}
    </div>
  );
}
