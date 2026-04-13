"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

interface LineItem { description: string; quantity: number; unit_price: number }

const inp = "w-full min-w-0 border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-amber";

export default function NewEstimatePage() {
  const router = useRouter();
  const supabase = createClient();

  const [pms, setPms] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [usePm, setUsePm] = useState(true);
  const [pmId, setPmId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
      if (!profile) return;

      const [{ data: pmList }, { data: propList }] = await Promise.all([
        supabase.from("property_managers").select("id, full_name, email").eq("tenant_id", profile.tenant_id).order("full_name"),
        supabase.from("properties").select("id, name, property_manager_id").eq("tenant_id", profile.tenant_id).order("name"),
      ]);
      setPms(pmList ?? []);
      setProperties(propList ?? []);
      if (pmList?.length) setPmId(pmList[0].id);
    };
    load();
  }, [supabase]);

  const filteredProps = properties.filter((p) => !pmId || p.property_manager_id === pmId);

  const addLineItem = () => setLineItems((prev) => [...prev, { description: "", quantity: 1, unit_price: 0 }]);
  const removeLineItem = (i: number) => setLineItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateLineItem = (i: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxAmount = Math.round((subtotal * taxRate) / 100 * 100) / 100;
  const total = subtotal + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    if (usePm && !pmId) { setError("Select a property manager"); return; }
    if (!usePm && !clientName.trim()) { setError("Client name is required"); return; }
    if (lineItems.some((l) => !l.description.trim())) { setError("All line items need a description"); return; }

    setLoading(true); setError("");

    const res = await fetch("/api/estimates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usePm,
        propertyManagerId: usePm ? pmId : undefined,
        propertyId: propertyId || undefined,
        clientName: usePm ? undefined : clientName.trim(),
        clientEmail: usePm ? undefined : (clientEmail.trim() || undefined),
        clientPhone: usePm ? undefined : (clientPhone.trim() || undefined),
        title: title.trim(),
        description: description.trim() || undefined,
        lineItems: lineItems.map((l) => ({
          description: l.description,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
        })),
        taxRate: taxRate || undefined,
        validUntil: validUntil || undefined,
        notes: notes.trim() || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to create estimate"); setLoading(false); return; }
    router.push(`/owner/estimates/${data.estimateId}`);
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/owner/estimates" className="text-mist hover:text-forge text-sm transition-colors">Estimates</Link>
        <span className="text-mist">/</span>
        <span className="text-sm text-forge">New Estimate</span>
      </div>
      <h1 className="font-display font-800 text-3xl text-forge mb-6">New Estimate</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-display font-700 text-lg text-forge">Client</h2>
            <label className="flex items-center gap-2 text-sm text-forge font-600">
              <input
                type="checkbox"
                checked={usePm}
                onChange={(e) => {
                  const next = e.target.checked;
                  setUsePm(next);
                  if (next && pms[0]) setPmId(pms[0].id);
                }}
                className="rounded border-gray-300 text-amber focus:ring-amber"
              />
              Estimate is for a property manager
            </label>
          </div>

          {usePm ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="pm" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">
                  Property Manager *
                </label>
                <select id="pm" value={pmId} onChange={(e) => { setPmId(e.target.value); setPropertyId(""); }} className={inp}>
                  <option value="">— Select —</option>
                  {pms.map((pm) => (
                    <option key={pm.id} value={pm.id}>{pm.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="property" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Property</label>
                <select id="property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className={inp} disabled={!pmId}>
                  <option value="">— None —</option>
                  {filteredProps.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="client-name" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Client name *</label>
                <input id="client-name" value={clientName} onChange={(e) => setClientName(e.target.value)} className={inp} placeholder="Customer full name" />
              </div>
              <div>
                <label htmlFor="client-email" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Client email</label>
                <input id="client-email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={inp} placeholder="customer@example.com" />
              </div>
              <div>
                <label htmlFor="client-phone" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Client phone</label>
                <input id="client-phone" type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className={inp} placeholder="(555) 123-4567" />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-display font-700 text-lg text-forge">Details</h2>
          <div>
            <label htmlFor="title" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Title *</label>
            <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className={inp} placeholder="Roof repair at Building A" />
          </div>
          <div>
            <label htmlFor="desc" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Scope of Work</label>
            <textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inp + " resize-none"} placeholder="Describe what will be done..." />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="valid-until" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Valid Until</label>
              <input id="valid-until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inp} />
            </div>
            <div>
              <label htmlFor="tax" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Tax Rate (%)</label>
              <input id="tax" type="number" value={taxRate || ""} onChange={(e) => setTaxRate(Number(e.target.value))} min="0" max="100" step="0.1" className={inp} placeholder="0" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-700 text-lg text-forge">Line Items</h2>
            <button type="button" onClick={addLineItem} className="text-sm text-amber hover:underline font-600">+ Add item</button>
          </div>

          <div className="space-y-3">
            {lineItems.map((item, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                <div className="md:col-span-6">
                  {i === 0 && <p className="text-xs text-mist mb-1 uppercase tracking-wider font-600">Description</p>}
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateLineItem(i, "description", e.target.value)}
                    placeholder="Labor, materials..."
                    className={inp}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  {i === 0 && <p className="text-xs text-mist mb-1 uppercase tracking-wider font-600">Qty</p>}
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(i, "quantity", Number(e.target.value))}
                    min="1"
                    step="1"
                    className={inp}
                  />
                </div>
                <div className="md:col-span-3">
                  {i === 0 && <p className="text-xs text-mist mb-1 uppercase tracking-wider font-600">Unit Price</p>}
                  <input
                    type="number"
                    value={item.unit_price || ""}
                    onChange={(e) => updateLineItem(i, "unit_price", Number(e.target.value))}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className={inp}
                  />
                </div>
                <div className="md:col-span-1 flex items-end justify-end pb-0.5">
                  {i === 0 && <p className="text-xs text-mist mb-1 uppercase tracking-wider font-600 invisible">x</p>}
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
          <label htmlFor="notes" className="block text-xs font-600 text-mist uppercase tracking-wider mb-2">Notes (visible to client)</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inp + " resize-none"} placeholder="Payment terms, warranty info, special conditions..." />
        </div>

        {error && <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex gap-3">
          <Link href="/owner/estimates" className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-600 hover:bg-gray-50 transition-colors">Cancel</Link>
          <button type="submit" disabled={loading || !title.trim() || (usePm && !pmId) || (!usePm && !clientName.trim())} className="flex-1 bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 py-2.5 rounded-lg text-base transition-colors min-h-[44px]">
            {loading ? "Creating..." : "Create Estimate"}
          </button>
        </div>
      </form>
    </div>
  );
}
