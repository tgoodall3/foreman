"use client";

import { useState } from "react";

function fmt(n: number | null | undefined) {
  if (n == null) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

type Props = {
  changeOrder: any;
  pm: any;
  job: any;
  tenant: any;
  token: string;
  result: string | undefined;
};

export default function PortalChangeOrderClient({ changeOrder, pm, job, tenant, token, result: initialResult }: Props) {
  const [result, setResult]     = useState(initialResult);
  const [loading, setLoading]   = useState(false);
  const [sigName, setSigName]   = useState("");
  const [sigError, setSigError] = useState("");

  const lineItems: any[] = Array.isArray(changeOrder.line_items) ? changeOrder.line_items : [];
  const isDone  = changeOrder.status === "approved" || changeOrder.status === "declined";
  const canAct  = !isDone && !result;

  const handleAction = async (status: "approved" | "declined") => {
    if (status === "approved" && !sigName.trim()) {
      setSigError("Please type your full name to authorize this change.");
      return;
    }
    setSigError("");
    setLoading(true);

    const res = await fetch("/api/portal/change-order/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, status }),
    });

    setLoading(false);
    setResult(res.ok ? status : "error");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

          {/* Brand bar */}
          <div className="bg-[#1a2332] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#f5a623] rounded flex items-center justify-center">
                <span className="font-bold text-[#1a2332] text-sm">{(tenant?.name ?? "F")[0].toUpperCase()}</span>
              </div>
              <span className="font-bold text-white text-base tracking-wide">{tenant?.name ?? "FOREMAN"}</span>
            </div>
            <span className="text-xs text-white/50 font-mono">{changeOrder.change_order_number}</span>
          </div>

          {/* Title + total */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold mb-1">Change Order</p>
                <h1 className="text-2xl font-bold text-gray-900">{changeOrder.title}</h1>
                {job?.title && <p className="text-sm text-gray-500 mt-1">For: {job.title}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold text-gray-900">{fmt(changeOrder.total)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Additional cost</p>
              </div>
            </div>
          </div>

          {/* Scope */}
          {changeOrder.description && (
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Scope of Change</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{changeOrder.description}</p>
            </div>
          )}

          {/* Line items */}
          {lineItems.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Line Items</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left pb-2 font-semibold text-gray-500 text-xs">Description</th>
                    <th className="text-right pb-2 font-semibold text-gray-500 text-xs">Qty</th>
                    <th className="text-right pb-2 font-semibold text-gray-500 text-xs">Unit</th>
                    <th className="text-right pb-2 font-semibold text-gray-500 text-xs">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lineItems.map((item: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2 text-gray-800">{item.description}</td>
                      <td className="py-2 text-right text-gray-500">{item.quantity}</td>
                      <td className="py-2 text-right text-gray-500">{fmt(item.unit_price)}</td>
                      <td className="py-2 text-right font-semibold text-gray-800">{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {changeOrder.tax_rate > 0 && (
                    <>
                      <tr>
                        <td colSpan={3} className="pt-3 text-right text-gray-500 text-xs">Subtotal</td>
                        <td className="pt-3 text-right text-gray-600 text-sm">{fmt(changeOrder.subtotal)}</td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="py-1 text-right text-gray-500 text-xs">Tax ({changeOrder.tax_rate}%)</td>
                        <td className="py-1 text-right text-gray-600 text-sm">{fmt(changeOrder.tax_amount)}</td>
                      </tr>
                    </>
                  )}
                  <tr className="border-t border-gray-200">
                    <td colSpan={3} className="pt-3 text-right font-semibold text-gray-800">Total Additional Cost</td>
                    <td className="pt-3 text-right font-bold text-xl text-gray-900">{fmt(changeOrder.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Notes */}
          {changeOrder.notes && (
            <div className="px-6 py-4 bg-amber-50 border-b border-amber-100">
              <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold mb-1">Note</p>
              <p className="text-sm text-amber-900 leading-relaxed">{changeOrder.notes}</p>
            </div>
          )}

          {/* Result banner */}
          {result && (
            <div className={`mx-6 my-4 rounded-lg border px-4 py-3 text-sm font-medium ${
              result === "approved"
                ? "bg-green-50 border-green-200 text-green-800"
                : result === "declined"
                ? "bg-gray-50 border-gray-200 text-gray-700"
                : "bg-red-50 border-red-200 text-red-800"
            }`}>
              {result === "approved" && "Thank you — the change order has been approved. The contractor has been notified."}
              {result === "declined" && "You declined this change order. The contractor has been notified."}
              {result === "error" && "We couldn't record your response. Please try again or contact the contractor directly."}
            </div>
          )}

          {/* Already resolved */}
          {isDone && !result && (
            <div className="mx-6 my-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              This change order has already been {changeOrder.status}.
            </div>
          )}

          {/* Signature + action */}
          {canAct && (
            <div className="px-6 py-5">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Authorization</p>
              <p className="text-xs text-gray-500 mb-3">
                By typing your name and clicking <strong>Approve</strong>, you authorize this additional work and the associated costs.
              </p>
              <input
                type="text"
                value={sigName}
                onChange={(e) => { setSigName(e.target.value); setSigError(""); }}
                placeholder="Type your full name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-gray-500 mb-1"
              />
              {sigError && <p className="text-xs text-red-600 mb-3">{sigError}</p>}

              {sigName.trim() && (
                <p className="font-serif italic text-lg text-gray-700 border-b border-gray-300 pb-1 mb-4 mt-2 px-1">
                  {sigName}
                </p>
              )}

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleAction("declined")}
                  disabled={loading}
                  className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={() => handleAction("approved")}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-50 transition-colors"
                >
                  {loading ? "Submitting…" : "Approve Change Order"}
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            {pm?.full_name && (
              <span>Questions? Contact {tenant?.name ?? "your contractor"}</span>
            )}
            <span>Powered by Foreman</span>
          </div>
        </div>
      </div>
    </div>
  );
}
