"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContainer";

export default function SendInvoiceWithEmail({
  invoiceId,
  defaultEmail,
  disabled,
}: {
  invoiceId: string;
  defaultEmail?: string | null;
  disabled?: boolean;
}) {
  const { addToast } = useToast();
  const [email, setEmail] = useState(defaultEmail || "");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (disabled || sending) return;
    if (!email) {
      addToast("Enter an email to send", "error");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      addToast("Invoice sent", "success");
    } catch (err) {
      addToast("Could not send invoice", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <p className="text-xs uppercase tracking-wider text-mist font-600">Send to email</p>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="customer@example.com"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber"
        />
        <button
          type="button"
          onClick={send}
          disabled={disabled || sending}
          className="px-4 py-2 rounded-lg text-sm font-700 bg-amber text-forge hover:bg-amber-dark disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send invoice"}
        </button>
      </div>
    </div>
  );
}
