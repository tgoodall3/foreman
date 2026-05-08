"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContainer";
import { useLanguage } from "@/lib/i18n";

interface Props {
  invoiceId: string;
  disabled?: boolean;
}

export default function ResendInvoiceButton({ invoiceId, disabled }: Props) {
  const { addToast } = useToast();
  const { t } = useLanguage();
  const [sending, setSending] = useState(false);

  const resend = async () => {
    if (disabled || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to send");
      addToast(t("invoices.reminderSent"), "success");
    } catch (err) {
      addToast(t("invoices.couldNotSendReminder"), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={resend}
      disabled={disabled || sending}
      className="inline-flex items-center justify-center gap-1 bg-white hover:bg-gray-50 disabled:opacity-50 text-forge border border-gray-300 text-xs sm:text-sm font-700 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg transition-colors min-h-[34px] sm:min-h-[40px] min-w-[82px] sm:min-w-[96px]"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {sending ? t("invoices.sending") : t("invoices.resend")}
    </button>
  );
}
