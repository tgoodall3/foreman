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
    <div className="mt-2 text-xs text-steel space-y-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-amber font-700 hover:underline"
      >
        {open ? "Cancel" : `Message ${pmName || "PM"}`}
      </button>
      {open && (
        <div className="space-y-1">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs"
            placeholder="Send a quick note to the PM"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={send}
              disabled={loading}
              className="bg-forge text-white px-3 py-1.5 rounded-lg text-xs font-700 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send"}
            </button>
            {error && <span className="text-red-600">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
