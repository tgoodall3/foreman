"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContainer";

interface Props {
  invoiceId: string;
  disabled?: boolean;
}

export default function ResendInvoiceButton({ invoiceId, disabled }: Props) {
  const { addToast } = useToast();
  const [sending, setSending] = useState(false);

  const resend = async () => {
    if (disabled || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to send");
      addToast("Reminder sent", "success");
    } catch (err) {
      addToast("Could not send reminder", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={resend}
      disabled={disabled || sending}
      className="text-xs font-700 text-amber hover:text-amber-dark disabled:opacity-50"
    >
      {sending ? "Sending…" : "Resend reminder"}
    </button>
  );
}
