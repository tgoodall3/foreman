"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastContainer";

interface Props {
  changeOrderId: string;
  jobId: string;
  status: string;
  pmEmail: string;
}

export default function ChangeOrderActions({ changeOrderId, jobId, status, pmEmail }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const doAction = async (action: string, method: string, url: string, body: object | null, successMsg: string, redirect?: string) => {
    setLoading(action);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) { addToast(data.error || "Something went wrong", "error"); return; }
    addToast(successMsg, "success");
    if (redirect) router.push(redirect);
    else router.refresh();
  };

  const send    = () => doAction("send",    "POST",   `/api/change-orders/${changeOrderId}/send`,   null,                      "Change order sent to property manager.");
  const approve = () => doAction("approve", "PATCH",  `/api/change-orders/${changeOrderId}/status`, { status: "approved" },    "Change order marked approved.");
  const decline = () => doAction("decline", "PATCH",  `/api/change-orders/${changeOrderId}/status`, { status: "declined" },    "Change order marked declined.");
  const del     = () => doAction("delete",  "DELETE", `/api/change-orders/${changeOrderId}`,        null,                      "Change order deleted.", `/owner/jobs/${jobId}`);

  const isDone = status === "approved" || status === "declined";

  const btn = (label: string, action: string, onClick: () => void, style: string) => (
    <button
      key={action}
      onClick={onClick}
      disabled={loading !== null}
      className={`px-4 py-2 rounded-lg text-sm font-display font-700 transition-colors min-h-[44px] disabled:opacity-50 ${style}`}
    >
      {loading === action ? "..." : label}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {!isDone && (
        <>
          {(status === "draft" || status === "sent") &&
            btn("Send to PM", "send", send, "bg-forge hover:bg-forge-light text-white")}
          {(status === "sent" || status === "draft") && (
            <>
              {btn("Mark Approved", "approve", approve, "bg-green-600 hover:bg-green-700 text-white")}
              {btn("Mark Declined", "decline", decline, "border border-red-300 text-red-600 hover:bg-red-50")}
            </>
          )}
        </>
      )}
      {status === "draft" && (
        <button
          onClick={del}
          disabled={loading !== null}
          className="px-4 py-2 rounded-lg text-sm font-display font-700 border border-gray-200 text-mist hover:text-red-600 hover:border-red-300 transition-colors min-h-[44px] disabled:opacity-50"
        >
          {loading === "delete" ? "..." : "Delete"}
        </button>
      )}
    </div>
  );
}
