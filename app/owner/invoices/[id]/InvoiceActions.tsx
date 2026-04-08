"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface InvoiceActionsProps {
  invoiceId: string;
  status: string;
}

export default function InvoiceActions({ invoiceId, status }: InvoiceActionsProps) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState("");

  const sendInvoice = async () => {
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      alert("Invoice sent successfully!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const markPaid = async () => {
    setMarking(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      router.refresh(); // Refresh to show updated status
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {status !== "paid" && (
        <>
          <button
            onClick={sendInvoice}
            disabled={sending}
            className="bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {sending ? "Sending…" : "Send Invoice"}
          </button>
          <button
            onClick={markPaid}
            disabled={marking}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-display font-700 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {marking ? "Updating…" : "Mark Paid"}
          </button>
        </>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
