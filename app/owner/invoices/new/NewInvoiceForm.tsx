"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface LineItemInput {
  description: string;
  quantity: number | string;
  unit_price: number | string;
}

interface JobOption {
  id: string;
  title: string;
  property_manager_id?: string | null;
  line_items?: any[];
}

interface PropertyManagerOption {
  id: string;
  full_name: string;
  company?: string;
  email?: string | null;
}

interface NewInvoiceFormProps {
  jobs: JobOption[];
  propertyManagers: PropertyManagerOption[];
  selectedJob?: JobOption | null;
}

const blankLineItem = (): LineItemInput => ({ description: "", quantity: 1, unit_price: 0 });

const inp = "w-full min-w-0 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber bg-white";
const lbl = "block text-xs font-600 text-mist uppercase tracking-wider mb-1";

export default function NewInvoiceForm({ jobs, propertyManagers, selectedJob }: NewInvoiceFormProps) {
  const router = useRouter();

  // Bill-to mode: "pm" = property manager, "client" = one-time direct client
  const [billTo, setBillTo] = useState<"pm" | "client">("pm");

  const [jobId, setJobId] = useState(selectedJob?.id || jobs[0]?.id || "");
  const [propertyManagerId, setPropertyManagerId] = useState(
    selectedJob?.property_manager_id || jobs[0]?.property_manager_id || propertyManagers[0]?.id || ""
  );
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const [status, setStatus] = useState("draft");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [lineItems, setLineItems] = useState<LineItemInput[]>(
    selectedJob?.line_items?.length
      ? selectedJob.line_items.map((item) => ({
          description: item.description ?? "",
          quantity: item.quantity ?? 1,
          unit_price: item.unit_price ?? 0,
        }))
      : [blankLineItem()]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedManager = propertyManagers.find((m) => m.id === propertyManagerId);
  const [sendTo, setSendTo] = useState(selectedManager?.email || propertyManagers[0]?.email || "");
  const selectedJobOption = jobs.find((job) => job.id === jobId);

  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const unit = Number(item.unit_price) || 0;
      return sum + qty * unit;
    }, 0);
  }, [lineItems]);

  const taxAmount = useMemo(() => {
    const rate = Number(taxRate) || 0;
    return Math.round((subtotal * rate) / 100 * 100) / 100;
  }, [subtotal, taxRate]);

  const total = useMemo(() => Math.round((subtotal + taxAmount) * 100) / 100, [subtotal, taxAmount]);
  const lineItemsAreValid = lineItems.every((item) => item.description.trim() && Number(item.quantity) > 0);

  useEffect(() => {
    const nextPmId = selectedJobOption?.property_manager_id || "";
    if (nextPmId && nextPmId !== propertyManagerId) setPropertyManagerId(nextPmId);
  }, [selectedJobOption?.property_manager_id, propertyManagerId]);

  useEffect(() => {
    if (billTo === "pm") setSendTo(selectedManager?.email || "");
  }, [selectedManager?.email, billTo]);

  const updateLineItem = (index: number, field: keyof LineItemInput, value: string) => {
    setLineItems((items) =>
      items.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const addLineItem = () => setLineItems((items) => [...items, blankLineItem()]);
  const removeLineItem = (index: number) => setLineItems((items) => items.filter((_, idx) => idx !== index));

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!jobId) { setError("Select a completed job before creating an invoice."); return; }
    if (billTo === "pm" && !propertyManagerId) { setError("Choose a property manager."); return; }
    if (billTo === "client" && !clientName.trim()) { setError("Enter the client name."); return; }
    if (!dueDate) { setError("A due date is required."); return; }
    if (!lineItemsAreValid) { setError("Please add at least one valid line item."); return; }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          ...(billTo === "pm"
            ? { propertyManagerId, emailOverride: sendTo?.trim() || undefined }
            : { clientName: clientName.trim(), clientEmail: clientEmail.trim() || undefined }),
          status,
          dueDate,
          notes: notes.trim(),
          taxRate: Number(taxRate),
          lineItems: lineItems.map((item) => ({
            description: item.description.trim(),
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || "Failed to create invoice.");
        setLoading(false);
        return;
      }

      router.push(`/owner/invoices/${data.invoiceId}`);
    } catch {
      setError("Unable to create invoice. Please try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: source job + line items */}
        <div className="space-y-6">
          <div className="surface-card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-display font-700 text-base text-forge">Source: completed job</h3>
            </div>
            <div className="p-5">
              <label className={lbl}>Completed Job</label>
              <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={inp}>
                <option value="">— Choose a completed job —</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>{job.title}</option>
                ))}
              </select>
            </div>

            <div className="px-5 py-3 border-t border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-display font-700 text-base text-forge">Line items</h3>
              <button type="button" onClick={addLineItem}
                className="text-xs font-600 text-amber hover:text-amber-dark transition-colors">
                + Add item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2 text-xs font-600 text-mist uppercase tracking-wider">Description</th>
                    <th className="text-right px-3 py-2 text-xs font-600 text-mist uppercase tracking-wider w-16">Qty</th>
                    <th className="text-right px-3 py-2 text-xs font-600 text-mist uppercase tracking-wider w-24">Unit price</th>
                    <th className="text-right px-3 py-2 text-xs font-600 text-mist uppercase tracking-wider w-24">Amount</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lineItems.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, "description", e.target.value)}
                          placeholder="Item description"
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-amber bg-white"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right font-mono focus:outline-none focus:border-amber bg-white"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateLineItem(index, "unit_price", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-right font-mono focus:outline-none focus:border-amber bg-white"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm tabular-nums">
                        {fmt((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
                      </td>
                      <td className="pr-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                          aria-label="Remove line item"
                        >×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
              <button type="button" onClick={addLineItem}
                className="text-xs font-600 text-amber hover:text-amber-dark transition-colors">
                + Add item
              </button>
              <div className="text-right">
                <div className="text-xs text-mist mb-0.5">Subtotal</div>
                <div className="font-mono font-500 text-lg tabular-nums text-forge">{fmt(subtotal)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: bill-to + totals */}
        <div className="space-y-6">
          <div className="surface-card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <h3 className="font-display font-700 text-base text-forge">Bill to</h3>
              <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs font-600">
                <button
                  type="button"
                  onClick={() => setBillTo("pm")}
                  className={`px-3 py-1.5 transition-colors ${billTo === "pm" ? "bg-forge text-white" : "text-mist hover:text-forge"}`}
                >
                  Property Manager
                </button>
                <button
                  type="button"
                  onClick={() => setBillTo("client")}
                  className={`px-3 py-1.5 border-l border-gray-200 transition-colors ${billTo === "client" ? "bg-forge text-white" : "text-mist hover:text-forge"}`}
                >
                  Direct Client
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {billTo === "pm" ? (
                <>
                  <div>
                    <label className={lbl}>Property Manager</label>
                    <select value={propertyManagerId} onChange={(e) => setPropertyManagerId(e.target.value)} className={inp}>
                      <option value="">— Choose property manager —</option>
                      {propertyManagers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}{m.company ? ` · ${m.company}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Send to (optional)</label>
                    <input
                      type="email"
                      value={sendTo}
                      onChange={(e) => setSendTo(e.target.value)}
                      placeholder="customer@example.com"
                      className={inp}
                    />
                    <p className="text-xs text-mist mt-1">Overrides the PM email on file when you send.</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className={lbl}>Client Name *</label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g. Jane Smith"
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className={lbl}>Client Email</label>
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="client@example.com"
                      className={inp}
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Invoice Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={inp}>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Due Date</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inp} />
                </div>
              </div>

              <div>
                <label className={lbl}>Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add invoice notes or payment instructions."
                  className={inp + " resize-none"}
                />
              </div>
            </div>
          </div>

          {/* Totals + submit */}
          <div className="surface-card overflow-hidden">
            <div className="p-5 space-y-3 border-b border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-mist font-500">Subtotal</span>
                <span className="font-mono tabular-nums">{fmt(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-mist font-500">Tax rate</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-16 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-right focus:outline-none focus:border-amber bg-white"
                  />
                  <span className="text-mist text-xs">%</span>
                </div>
                <span className="font-mono tabular-nums">{fmt(taxAmount)}</span>
              </div>
            </div>
            <div className="px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-600 text-forge">Total due</span>
              <span className="font-mono font-700 text-2xl tabular-nums text-forge">{fmt(total)}</span>
            </div>

            {error && (
              <div role="alert" className="mx-5 mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="px-5 pb-5 flex gap-3">
              <Link href="/owner/invoices"
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-600 hover:bg-gray-50 transition-colors">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={
                  loading ||
                  !jobId ||
                  (billTo === "pm" ? !propertyManagerId : !clientName.trim()) ||
                  !lineItemsAreValid
                }
                className="flex-1 bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 py-2.5 rounded-lg text-base transition-colors min-h-[44px]"
              >
                {loading ? "Saving…" : "Create Invoice"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
