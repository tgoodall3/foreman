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
      className="inline-flex items-center justify-center gap-1 bg-forge hover:bg-forge-light disabled:opacity-50 text-white text-xs sm:text-sm font-700 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg transition-colors min-h-[34px] sm:min-h-[40px] min-w-[82px] sm:min-w-[96px]"
    >
      {sending ? "Sending…" : label}
    </button>
  );
}
