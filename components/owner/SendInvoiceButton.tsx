"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContainer";

interface Props {
  invoiceId: string;
  disabled?: boolean;
  label?: string;
}

export default function SendInvoiceButton({ invoiceId, disabled, label = "Send" }: Props) {
  const { addToast } = useToast();
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (disabled || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, { method: "POST" });
      if (!res.ok) throw new Error();
      addToast("Invoice sent", "success");
    } catch (err) {
      addToast("Could not send invoice", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={send}
      disabled={disabled || sending}
      className="text-xs font-700 text-amber hover:text-amber-dark disabled:opacity-50"
    >
      {sending ? "Sending…" : label}
    </button>
  );
}
