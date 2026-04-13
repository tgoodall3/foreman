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

export default function NewInvoiceForm({ jobs, propertyManagers, selectedJob }: NewInvoiceFormProps) {
  const router = useRouter();
  const [jobId, setJobId] = useState(selectedJob?.id || jobs[0]?.id || "");
  const [propertyManagerId, setPropertyManagerId] = useState(
    selectedJob?.property_manager_id || jobs[0]?.property_manager_id || propertyManagers[0]?.id || ""
  );
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

  const selectedManager = propertyManagers.find((manager) => manager.id === propertyManagerId);
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
    if (nextPmId && nextPmId !== propertyManagerId) {
      setPropertyManagerId(nextPmId);
    }
  }, [selectedJobOption?.property_manager_id, propertyManagerId]);

  useEffect(() => {
    setSendTo(selectedManager?.email || "");
  }, [selectedManager?.email]);

  const updateLineItem = (index: number, field: keyof LineItemInput, value: string) => {
    setLineItems((items) =>
      items.map((item, idx) => (idx === index ? { ...item, [field]: field === "description" ? value : value } : item))
    );
  };

  const addLineItem = () => setLineItems((items) => [...items, blankLineItem()]);
  const removeLineItem = (index: number) => setLineItems((items) => items.filter((_, idx) => idx !== index));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!jobId) { setError("Select a completed job before creating an invoice."); return; }
    if (!propertyManagerId) { setError("Choose a property manager."); return; }
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
          propertyManagerId,
          status,
          dueDate,
          notes: notes.trim(),
          taxRate: Number(taxRate),
          emailOverride: sendTo?.trim() || undefined,
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
    } catch (submitError) {
      setError("Unable to create invoice. Please try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5 grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="job" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Completed Job</label>
          <select id="job" value={jobId} onChange={(event) => setJobId(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber" aria-describedby="job-help">
            <option value="">— Choose a completed job —</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>{job.title}</option>
            ))}
          </select>
          <p id="job-help" className="sr-only">Select the job to generate an invoice for</p>
        </div>

        <div>
          <label htmlFor="manager" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Property Manager</label>
          <select id="manager" value={propertyManagerId} onChange={(event) => setPropertyManagerId(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber">
            <option value="">— Choose property manager —</option>
            {propertyManagers.map((manager) => (
              <option key={manager.id} value={manager.id}>{manager.full_name}{manager.company ? ` · ${manager.company}` : ""}</option>
            ))}
          </select>
          {selectedManager && (
            <p className="text-xs text-mist mt-2">Billing contact: {selectedManager.full_name}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="send-to" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Send to (optional)</label>
          <input
            id="send-to"
            type="email"
            value={sendTo}
            onChange={(e) => setSendTo(e.target.value)}
            placeholder="customer@example.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber"
          />
          <p className="text-[11px] text-mist mt-1">Overrides the PM email on file when you send.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="status" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Invoice Status</label>
          <select id="status" value={status} onChange={(event) => setStatus(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber">
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <div>
          <label htmlFor="due-date" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Due Date</label>
          <input
            id="due-date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="w-full min-w-0 max-w-full border border-gray-300 rounded-lg px-3 py-2.5 sm:py-3 text-sm focus:outline-none focus:border-amber"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-700 text-lg text-forge">Line Items</h2>
            <p className="text-xs text-mist mt-1">Add the work items and pricing for this invoice.</p>
          </div>
          <button type="button" onClick={addLineItem} className="text-amber text-sm font-700 hover:underline">
            + Add item
          </button>
        </div>

        <div className="space-y-5">
          {lineItems.map((item, index) => (
            <div
              key={index}
              className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] items-start sm:items-end border border-gray-100 rounded-lg p-3 sm:p-0"
            >
              <div>
                <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Description</label>
                <input type="text" value={item.description} onChange={(event) => updateLineItem(index, "description", event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber" placeholder="Item description" />
              </div>
              <div>
                <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Qty</label>
                <input type="number" min="1" value={item.quantity} onChange={(event) => updateLineItem(index, "quantity", event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber" />
              </div>
              <div>
                <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Unit Price</label>
                <input type="number" min="0" step="0.01" value={item.unit_price} onChange={(event) => updateLineItem(index, "unit_price", event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber" />
              </div>
              <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1">
                <div className="text-xs text-mist w-full text-right sm:text-left">
                  ${((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toFixed(2)}
                </div>
                <button
                  type="button"
                  onClick={() => removeLineItem(index)}
                  className="text-red-600 text-sm font-600 hover:underline w-full sm:w-auto text-right sm:text-left"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <p className="text-xs text-mist uppercase tracking-wider font-600">Subtotal</p>
          <p className="font-800 text-forge text-2xl mt-2">${subtotal.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <label htmlFor="tax-rate" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Tax Rate</label>
          <input id="tax-rate" type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber" />
          <p className="text-xs text-mist mt-2">Amount: ${taxAmount.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <p className="text-xs text-mist uppercase tracking-wider font-600">Total</p>
          <p className="font-800 text-forge text-2xl mt-2">${total.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <label htmlFor="notes" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Notes</label>
        <textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber resize-none" placeholder="Add invoice notes or payment instructions." />
      </div>

      {error && <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/owner/invoices" className="text-sm font-semibold text-mist hover:text-forge">Cancel</Link>
        <button type="submit" disabled={loading || !jobId || !propertyManagerId || !lineItemsAreValid} className="bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 py-3 px-5 rounded-lg text-sm transition-colors">
          {loading ? "Saving…" : "Create Invoice"}
        </button>
      </div>
    </form>
  );
}
