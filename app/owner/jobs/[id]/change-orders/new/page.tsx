"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface LineItem { description: string; quantity: number; unit_price: number }

const inp = "w-full min-w-0 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber";

export default function NewChangeOrderPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const jobId = params.id;

  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [taxRate, setTaxRate]       = useState(0);
  const [notes, setNotes]           = useState("");
  const [lineItems, setLineItems]   = useState<LineItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  const addLineItem    = () => setLineItems((p) => [...p, { description: "", quantity: 1, unit_price: 0 }]);
  const removeLineItem = (i: number) => setLineItems((p) => p.filter((_, idx) => idx !== i));
  const updateLineItem = (i: number, field: keyof LineItem, value: string | number) =>
    setLineItems((p) => p.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));

  const subtotal  = lineItems.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const taxAmount = Math.round(subtotal * taxRate / 100 * 100) / 100;
  const total     = subtotal + taxAmount;
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (lineItems.some((l) => !l.description.trim())) { setError("All line items need a description."); return; }

    setLoading(true); setError("");
    const res = await fetch("/api/change-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId,
        title: title.trim(),
        description: description.trim() || undefined,
        lineItems: lineItems.map((l) => ({
          description: l.description,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
        })),
        taxRate: taxRate || undefined,
        notes: notes.trim() || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to create change order."); setLoading(false); return; }
    router.push(`/owner/change-orders/${data.changeOrderId}`);
  };

  return (
    <div className="page-shell page-shell-tight">
      <div className="flex items-center gap-2 mb-6">
        <Link href={`/owner/jobs/${jobId}`} className="text-mist hover:text-forge text-sm transition-colors">Job</Link>
        <span className="text-mist">/</span>
        <span className="text-sm text-forge">New Change Order</span>
      </div>
      <h1 className="page-title">New Change Order</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-display font-700 text-lg text-forge">Details</h2>
          <div>
            <label htmlFor="title" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Title *</label>
            <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inp} placeholder="e.g. Additional electrical work" required />
          </div>
          <div>
            <label htmlFor="desc" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Scope of Change</label>
            <textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inp + " resize-none"} placeholder="Describe what additional work is needed and why..." />
          </div>
          <div>
            <label htmlFor="tax" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Tax Rate (%)</label>
            <input id="tax" type="number" value={taxRate || ""} onChange={(e) => setTaxRate(Number(e.target.value))} min="0" max="100" step="0.1" className={inp} placeholder="0" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-700 text-lg text-forge">Line Items</h2>
            <button type="button" onClick={addLineItem} className="text-sm text-amber hover:underline font-600">+ Add Item</button>
          </div>

          <div className="space-y-3">
            {lineItems.map((item, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                <div className="md:col-span-6">
                  {i === 0 && <p className="text-xs text-mist mb-1 uppercase tracking-wider font-600">Description</p>}
                  <input type="text" value={item.description} onChange={(e) => updateLineItem(i, "description", e.target.value)} placeholder="Item description" className={inp} required />
                </div>
                <div className="md:col-span-2">
                  {i === 0 && <p className="text-xs text-mist mb-1 uppercase tracking-wider font-600">Qty</p>}
                  <input type="number" value={item.quantity} onChange={(e) => updateLineItem(i, "quantity", Number(e.target.value))} min="1" step="1" className={inp} />
                </div>
                <div className="md:col-span-3">
                  {i === 0 && <p className="text-xs text-mist mb-1 uppercase tracking-wider font-600">Unit Price</p>}
                  <input type="number" value={item.unit_price || ""} onChange={(e) => updateLineItem(i, "unit_price", Number(e.target.value))} min="0" step="0.01" placeholder="0.00" className={inp} />
                </div>
                <div className="md:col-span-1 flex items-end justify-end pb-0.5">
                  {i === 0 && <p className="text-xs text-mist mb-1 invisible">x</p>}
                  {lineItems.length > 1 && (
                    <button type="button" onClick={() => removeLineItem(i)} className="text-mist hover:text-red-500 transition-colors p-2" aria-label="Remove item">×</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100 space-y-1 text-sm">
            <div className="flex justify-between text-mist">
              <span>Subtotal</span><span className="font-600">{fmt(subtotal)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-mist">
                <span>Tax ({taxRate}%)</span><span className="font-600">{fmt(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-forge font-display font-800 text-lg pt-1 border-t border-gray-200 mt-1">
              <span>Total</span><span>{fmt(total)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label htmlFor="notes" className="block text-xs font-600 text-mist uppercase tracking-wider mb-2">Notes to Client</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inp + " resize-none"} placeholder="Any additional notes for the property manager..." />
        </div>

        {error && <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex gap-3">
          <Link href={`/owner/jobs/${jobId}`} className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-600 hover:bg-gray-50 transition-colors">Cancel</Link>
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="flex-1 bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 py-2.5 rounded-lg text-base transition-colors min-h-[44px]"
          >
            {loading ? "Creating..." : "Create Change Order"}
          </button>
        </div>
      </form>
    </div>
  );
}
