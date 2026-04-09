"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface InvoiceActionsProps {
  invoiceId: string;
  status: string;
}

export default function InvoiceActions({ invoiceId, status }: InvoiceActionsProps) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [sending,    setSending]    = useState(false);
  const [marking,    setMarking]    = useState(false);
  const [payLink,    setPayLink]    = useState(false);
  const [copiedLink, setCopiedLink] = useState("");
  const [error, setError]           = useState("");
  const [allowACH, setAllowACH] = useState(true);
  const [allowTips, setAllowTips] = useState(false);
  const [tipAmount, setTipAmount] = useState("0");
  const [deposit, setDeposit] = useState("");

  // Show success toast if redirected back from Stripe
  const justPaid = searchParams.get("paid") === "true";

  const sendInvoice = async () => {
    setSending(true); setError("");
    const res = await fetch(`/api/invoices/${invoiceId}/send`, { method: "POST" });
    const data = await res.json();
    setSending(false);
    if (!res.ok) { setError(data.error || "Failed to send"); return; }
    router.refresh();
  };

  const markPaid = async () => {
    setMarking(true); setError("");
    const res = await fetch(`/api/invoices/${invoiceId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    const data = await res.json();
    setMarking(false);
    if (!res.ok) { setError(data.error || "Failed to update"); return; }
    router.refresh();
  };

  const getPayLink = async () => {
    setPayLink(true); setError("");
    const amountNumber = deposit ? Number(deposit) : null;
    const tipNumber = allowTips && tipAmount ? Number(tipAmount) : 0;
    const res = await fetch(`/api/invoices/${invoiceId}/pay-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allowACH,
        allowTips,
        tipAmount: tipNumber,
        amount: amountNumber,
      }),
    });
    const data = await res.json();
    setPayLink(false);
    if (!res.ok) { setError(data.error || "Failed to create link"); return; }
    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(data.url);
      setCopiedLink(data.url);
    } catch {
      setCopiedLink(data.url); // fallback: show the URL
    }
    router.refresh(); // status may have changed to "sent"
  };

  if (status === "paid") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-green-700 font-600 text-sm">
          <span className="text-green-500">✓</span> Paid
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      {justPaid && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 font-600">
          Payment received!
        </p>
      )}

      <div className="flex flex-wrap gap-2 justify-end">
        <button
          onClick={sendInvoice}
          disabled={sending}
          className="bg-forge hover:bg-forge-light disabled:opacity-50 text-white font-display font-700 px-4 py-2 rounded-lg text-sm transition-colors min-h-[44px]"
        >
          {sending ? "Sending…" : "Email Invoice"}
        </button>

        <button
          onClick={getPayLink}
          disabled={payLink}
          className="bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 px-4 py-2 rounded-lg text-sm transition-colors min-h-[44px]"
        >
          {payLink ? "Creating…" : "Get Pay Link"}
        </button>

        <button
          onClick={markPaid}
          disabled={marking}
          className="border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50 font-display font-700 px-4 py-2 rounded-lg text-sm transition-colors min-h-[44px]"
        >
          {marking ? "Updating…" : "Mark Paid"}
        </button>
      </div>

      {copiedLink && (
        <div className="w-full mt-1 bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-xs font-600 text-green-700 mb-1.5">✓ Pay link copied to clipboard — send it to your client:</p>
          <p className="text-xs text-green-800 break-all font-mono bg-white border border-green-100 rounded px-2 py-1">
            {copiedLink}
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{error}</p>}

      {/* Payment options */}
      <div className="w-full mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
          <input type="checkbox" checked={allowACH} onChange={(e) => setAllowACH(e.target.checked)} />
          Allow ACH (bank)
        </label>
        <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
          <input type="checkbox" checked={allowTips} onChange={(e) => setAllowTips(e.target.checked)} />
          Allow tips
        </label>
        <div className="border border-gray-200 rounded-lg px-3 py-2">
          <p className="text-mist mb-1">Deposit / Partial amount</p>
          <input
            type="number"
            min="0"
            step="0.01"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded px-2 py-1"
            placeholder="Leave blank for full amount"
          />
        </div>
        <div className="border border-gray-200 rounded-lg px-3 py-2">
          <p className="text-mist mb-1">Tip amount</p>
          <input
            type="number"
            min="0"
            step="0.01"
            value={tipAmount}
            onChange={(e) => setTipAmount(e.target.value)}
            disabled={!allowTips}
            className="w-full text-sm border border-gray-200 rounded px-2 py-1 disabled:bg-gray-50"
            placeholder="0.00"
          />
        </div>
      </div>
    </div>
  );
}
