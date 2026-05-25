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

  const inpStyle = {
    width: "100%",
    border: "1px solid var(--line-2)",
    borderRadius: "var(--r)",
    padding: "0 10px",
    height: 36,
    background: "var(--surface)",
    color: "var(--ink)",
    fontFamily: "var(--sans)",
    fontSize: 13.5,
  } as React.CSSProperties;

  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "4px 12px",
    fontSize: 12.5,
    border: "none",
    cursor: "pointer",
    background: active ? "var(--ink)" : "transparent",
    color: active ? "var(--paper)" : "var(--muted)",
    fontFamily: "var(--sans)",
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid-2">
        {/* Left: source jobs + line items */}
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h3>Source: completed job</h3>
            </div>
            <div className="fieldset">
              <div className="form-grid">
                <div className="field span-2">
                  <div className="lbl">Completed Job</div>
                  <select value={jobId} onChange={(e) => setJobId(e.target.value)} style={inpStyle}>
                    <option value="">— Choose a completed job —</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>{job.title}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="card-head" style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
              <h3>Line items</h3>
              <button type="button" onClick={addLineItem} className="btn btn--sm">+ Add item</button>
            </div>

            <table className="tbl">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style={{ width: 64 }}>Qty</th>
                  <th style={{ width: 90 }}>Unit price</th>
                  <th style={{ width: 90 }}>Amount</th>
                  <th style={{ width: 24 }} />
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, "description", e.target.value)}
                        placeholder="Item description"
                        style={{ width: "100%", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", padding: "4px 8px", fontSize: 13, fontFamily: "var(--sans)", background: "var(--surface)" }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                        style={{ width: "100%", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", padding: "4px 8px", fontSize: 13, fontFamily: "var(--mono)", background: "var(--surface)" }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateLineItem(index, "unit_price", e.target.value)}
                        style={{ width: "100%", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", padding: "4px 8px", fontSize: 13, fontFamily: "var(--mono)", background: "var(--surface)" }}
                      />
                    </td>
                    <td className="mono num">
                      {fmt((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 16, lineHeight: 1, padding: "0 4px" }}
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ padding: "14px 18px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button type="button" onClick={addLineItem} className="btn btn--sm">+ Add item</button>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Subtotal</div>
                <div className="mono num" style={{ fontSize: 20, fontWeight: 500 }}>{fmt(subtotal)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: bill-to + totals */}
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h3>Bill to</h3>
              <div style={{ display: "flex", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
                <button type="button" onClick={() => setBillTo("pm")} style={toggleBtnStyle(billTo === "pm")}>
                  Property Manager
                </button>
                <button
                  type="button"
                  onClick={() => setBillTo("client")}
                  style={{ ...toggleBtnStyle(billTo === "client"), borderLeft: "1px solid var(--line-2)" }}
                >
                  Direct Client
                </button>
              </div>
            </div>
            <div className="fieldset">
              <div className="form-grid">
                {billTo === "pm" ? (
                  <>
                    <div className="field span-2">
                      <div className="lbl">Property Manager</div>
                      <select value={propertyManagerId} onChange={(e) => setPropertyManagerId(e.target.value)} style={inpStyle}>
                        <option value="">— Choose property manager —</option>
                        {propertyManagers.map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {manager.full_name}{manager.company ? ` · ${manager.company}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field span-2">
                      <div className="lbl">Send to (optional)</div>
                      <input
                        type="email"
                        value={sendTo}
                        onChange={(e) => setSendTo(e.target.value)}
                        placeholder="customer@example.com"
                        style={inpStyle}
                      />
                      <div className="hint">Overrides the PM email on file when you send.</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="field span-2">
                      <div className="lbl">Client Name *</div>
                      <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="e.g. Jane Smith"
                        style={inpStyle}
                      />
                    </div>
                    <div className="field span-2">
                      <div className="lbl">Client Email</div>
                      <input
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="client@example.com"
                        style={inpStyle}
                      />
                    </div>
                  </>
                )}

                <div className="field">
                  <div className="lbl">Invoice Status</div>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} style={inpStyle}>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
                <div className="field">
                  <div className="lbl">Due Date</div>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inpStyle} />
                </div>
                <div className="field span-2">
                  <div className="lbl">Notes</div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Add invoice notes or payment instructions."
                    style={{ resize: "none" }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="fieldset" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="between" style={{ marginBottom: 8 }}>
                <div className="kicker">Subtotal</div>
                <div className="mono num">{fmt(subtotal)}</div>
              </div>
              <div className="between" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="kicker">Tax rate</div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    style={{ width: 64, border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", padding: "2px 6px", fontSize: 12, fontFamily: "var(--mono)", background: "var(--surface)" }}
                  />
                  <span className="kicker">%</span>
                </div>
                <div className="mono num">{fmt(taxAmount)}</div>
              </div>
            </div>
            <div className="fieldset" style={{ borderBottom: "none" }}>
              <div className="between">
                <div style={{ fontSize: 14, fontWeight: 500 }}>Total due</div>
                <div className="mono num" style={{ fontSize: 22, fontWeight: 500 }}>{fmt(total)}</div>
              </div>
            </div>
            {error && (
              <div style={{ margin: "0 18px 14px", fontSize: 13, color: "var(--red)", padding: "8px 12px", background: "var(--red-soft)", borderRadius: "var(--r)" }}>
                {error}
              </div>
            )}
            <div style={{ padding: "14px 18px", borderTop: "1px solid var(--line)", display: "flex", gap: 8 }}>
              <Link href="/owner/invoices" className="btn">Cancel</Link>
              <button
                type="submit"
                disabled={
                  loading ||
                  !jobId ||
                  (billTo === "pm" ? !propertyManagerId : !clientName.trim()) ||
                  !lineItemsAreValid
                }
                className="btn btn--orange"
                style={{ marginLeft: "auto", opacity: loading ? 0.6 : 1 }}
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
