"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContainer";

export default function MessagePM({ workOrderId, pmName }: { workOrderId: string; pmName: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { addToast } = useToast();

  const send = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/work-orders/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workOrderId, message }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      const msg = data.error || "Failed to send";
      setError(msg);
      addToast(msg, "error");
      return;
    }
    addToast("Message sent to PM", "success");
    setMessage("");
    setOpen(false);
  };

  return (
    <div className="mt-2 space-y-2 text-sm text-steel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-700 text-steel transition-colors hover:border-amber hover:text-amber"
      >
        {open ? "Cancel" : `Message ${pmName || "PM"}`}
      </button>
      {open && (
        <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            placeholder="Send a quick note to the PM"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={send}
              disabled={loading}
              className="rounded-lg bg-forge px-3 py-2 text-sm font-700 text-white disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send"}
            </button>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
