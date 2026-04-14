"use client";

import { useState, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function fmt(n: number | null | undefined) {
  if (n == null) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

type Props = {
  invoice: any;
  pm: any;
  tenant: any;
  job: any;
  paidSuccess: boolean;
};

export default function PortalInvoiceClient({ invoice, pm, tenant, job, paidSuccess }: Props) {
  const [sigName, setSigName]         = useState("");
  const [sigError, setSigError]       = useState("");
  const [payError, setPayError]       = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingPay, setLoadingPay]   = useState(false);

  const lineItems: any[] = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const isPaid    = invoice.status === "paid" || paidSuccess;
  const isPayable = ["sent", "overdue"].includes(invoice.status) && !paidSuccess;
  const isOverdue = invoice.status === "overdue";

  const tenantName = tenant?.name || "Foreman customer";

  const handlePay = async () => {
    if (!sigName.trim()) {
      setSigError("Please type your full name to authorise payment.");
      return;
    }
    setSigError("");
    setLoadingPay(true);
    setPayError("");

    const res = await fetch("/api/portal/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice_id: invoice.id,
        allowACH: true,
        signature_name: sigName.trim(),
      }),
    });

    const data = await res.json();
    setLoadingPay(false);

    if (!res.ok) {
      setPayError(data.error ?? "Unable to start payment. Please try again.");
      return;
    }

    setClientSecret(data.clientSecret);
    setShowCheckout(true);
  };

  const fetchClientSecret = useCallback(() => Promise.resolve(clientSecret!), [clientSecret]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="w-full max-w-2xl mx-auto space-y-4">

        {/* Main invoice card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

          {/* Brand bar */}
          <div className="bg-[#0f1923] px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#f59e0b] rounded-lg flex items-center justify-center shrink-0">
                <span className="font-bold text-[#0f1923] text-lg leading-none">
                  {tenantName[0]?.toUpperCase() ?? "F"}
                </span>
              </div>
              <div>
                <p className="font-bold text-white text-base tracking-wide leading-none">{tenantName}</p>
                <p className="text-white/50 text-xs mt-0.5">Invoice</p>
              </div>
            </div>
            <span className="text-xs text-white/40 font-mono">{invoice.invoice_number}</span>
          </div>

          {/* Invoice header */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400 font-semibold mb-1">
                  Invoice for {pm.full_name}
                  {pm.company ? ` · ${pm.company}` : ""}
                </p>
                {job?.title && (
                  <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold text-gray-900">{fmt(invoice.total)}</p>
                {invoice.due_date && (
                  <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                    {isOverdue ? "Overdue — was due " : "Due "}
                    {fmtDate(invoice.due_date)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Paid success banner */}
          {isPaid && (
            <div className="mx-6 my-4 bg-green-50 border border-green-200 rounded-xl px-4 py-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-green-800 text-sm">Payment received — thank you!</p>
                <p className="text-green-700 text-xs mt-0.5">
                  {tenantName} has been notified. A receipt will be sent to {pm.email}.
                </p>
              </div>
            </div>
          )}

          {/* Overdue warning */}
          {isOverdue && !isPaid && (
            <div className="mx-6 my-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="font-semibold text-red-700 text-sm">This invoice is past due.</p>
              <p className="text-red-600 text-xs mt-0.5">
                Please arrange payment at your earliest convenience.
              </p>
            </div>
          )}

          {/* Line items */}
          {lineItems.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Work Summary</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left pb-2 font-semibold text-gray-500 text-xs">Description</th>
                    <th className="text-right pb-2 font-semibold text-gray-500 text-xs w-12">Qty</th>
                    <th className="text-right pb-2 font-semibold text-gray-500 text-xs w-20">Unit</th>
                    <th className="text-right pb-2 font-semibold text-gray-500 text-xs w-20">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lineItems.map((item: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2.5 text-gray-800">{item.description}</td>
                      <td className="py-2.5 text-right text-gray-500">{item.quantity}</td>
                      <td className="py-2.5 text-right text-gray-500">{fmt(item.unit_price)}</td>
                      <td className="py-2.5 text-right font-semibold text-gray-800">{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {(invoice.tax_rate ?? 0) > 0 && (
                    <>
                      <tr>
                        <td colSpan={3} className="pt-3 text-right text-gray-400 text-xs">Subtotal</td>
                        <td className="pt-3 text-right text-gray-600 text-sm">{fmt(invoice.subtotal)}</td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="py-1 text-right text-gray-400 text-xs">Tax ({invoice.tax_rate}%)</td>
                        <td className="py-1 text-right text-gray-600 text-sm">{fmt(invoice.tax_amount)}</td>
                      </tr>
                    </>
                  )}
                  <tr className="border-t border-gray-200">
                    <td colSpan={3} className="pt-3 text-right font-semibold text-gray-700">Total Due</td>
                    <td className="pt-3 text-right font-bold text-xl text-gray-900">{fmt(invoice.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="px-6 py-4 bg-amber-50 border-b border-amber-100">
              <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold mb-1">Notes</p>
              <p className="text-sm text-amber-900 leading-relaxed">{invoice.notes}</p>
            </div>
          )}

          {/* Sign & Pay section */}
          {isPayable && !showCheckout && (
            <div className="px-6 py-5">
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3">Authorise Payment</p>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                By typing your name below you confirm the work has been completed to satisfaction
                and authorise payment of {fmt(invoice.total)} to {tenantName}.
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

              {payError && (
                <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {payError}
                </div>
              )}

              <button
                onClick={handlePay}
                disabled={loadingPay}
                className="w-full bg-[#0f1923] hover:bg-gray-800 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loadingPay ? (
                  "Loading secure payment…"
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                      <line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                    Pay {fmt(invoice.total)} Securely
                  </>
                )}
              </button>
              <p className="text-center text-xs text-gray-400 mt-2">
                Card and ACH accepted · Secured by Stripe
              </p>
            </div>
          )}

          {/* Embedded Stripe Checkout */}
          {isPayable && showCheckout && clientSecret && (
            <div className="px-4 py-4">
              <button
                onClick={() => setShowCheckout(false)}
                className="mb-3 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                ← Back
              </button>
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ fetchClientSecret }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>
              Questions? Contact {tenantName}
              {tenant?.email ? ` at ${tenant.email}` : ""}.
            </span>
            <span>Powered by Foreman</span>
          </div>
        </div>

      </div>
    </div>
  );
}
