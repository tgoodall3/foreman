"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PropertyManager {
  id: string;
  full_name: string;
  email: string;
  company?: string | null;
  tenant_id: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
}

interface WorkOrder {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  properties?: { name: string } | null;
  job_status?: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  total: number;
  due_date: string | null;
  created_at: string;
  jobs?: { title: string } | null;
}

interface Comment {
  id: string;
  work_order_id: string;
  message: string;
  created_at: string;
  property_managers?: { full_name?: string };
}

interface Props {
  token: string;
  propertyManager: PropertyManager;
  tenantName: string;
  properties: Property[];
  workOrders: WorkOrder[];
  invoices: Invoice[];
  comments: Comment[];
  initialTab?: Tab;
  paidSuccess?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

const WO_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending:     { label: "Pending",     bg: "bg-yellow-100", color: "text-yellow-800" },
  accepted:    { label: "Accepted",    bg: "bg-blue-100",   color: "text-blue-800"   },
  in_progress: { label: "In Progress", bg: "bg-blue-100",   color: "text-blue-800"   },
  completed:   { label: "Work completed", bg: "bg-green-100",  color: "text-green-800"  },
  cancelled:   { label: "Cancelled",   bg: "bg-gray-100",   color: "text-gray-500"   },
};

const INV_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  draft:   { label: "Draft",   bg: "bg-gray-100",   color: "text-gray-500"   },
  sent:    { label: "Due",     bg: "bg-blue-100",   color: "text-blue-800"   },
  overdue: { label: "Overdue", bg: "bg-red-100",    color: "text-red-700"    },
  paid:    { label: "Paid",    bg: "bg-green-100",  color: "text-green-800"  },
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Low", normal: "Normal", urgent: "Urgent", emergency: "Emergency",
};

function PropertyCreate({
  token,
  tenantName,
  defaultOpen = false,
  inline = false,
  onCreated,
}: {
  token: string;
  tenantName: string;
  defaultOpen?: boolean;
  inline?: boolean;
  onCreated: (p: Property) => void;
}) {
  const [open, setOpen] = useState(defaultOpen || inline);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/portal/property", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, address, city, state, zip, notes }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error || "Could not add property."); return; }
    onCreated(data.property);
    setSuccess("Property added. You can submit work orders for it now.");
    setName(""); setAddress(""); setCity(""); setState(""); setZip(""); setNotes("");
    setOpen(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display font-700 text-base text-forge">Add a Property</p>
          <p className="text-xs text-mist">Links this portal to a property so you can submit work orders.</p>
        </div>
        {!inline && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-sm font-600 text-amber hover:underline"
          >
            {open ? "Close" : "Add property"}
          </button>
        )}
      </div>
      {success && <p className="text-xs text-green-700 mt-2">{success}</p>}
      {open && (
        <form onSubmit={submit} className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">Address *</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">City *</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">State *</label>
            <input value={state} onChange={(e) => setState(e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">ZIP *</label>
            <input value={zip} onChange={(e) => setZip(e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          {error && <p className="text-xs text-red-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-mist hover:text-forge"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name || !address || !city || !state || !zip}
              className="bg-amber text-forge font-display font-700 px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save & link"}
            </button>
          </div>
        </form>
      )}
      <p className="text-[11px] text-mist mt-2">Owner will be notified when you add a property to {tenantName}.</p>
    </div>
  );
}

// ─── Comment Form ──────────────────────────────────────────────────────────────
function CommentForm({ token, workOrderId, onAdded }: { token: string; workOrderId: string; onAdded: (c: Comment) => void }) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!message.trim()) return;
    setSubmitting(true); setError("");
    const res = await fetch("/api/portal/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, work_order_id: workOrderId, message: message.trim() }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error || "Failed to add comment"); return; }
    onAdded(data.comment);
    setMessage("");
  };

  return (
    <div className="mt-2 space-y-1">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs"
        placeholder="Add a comment…"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="bg-forge text-white text-xs font-700 px-3 py-1.5 rounded-lg disabled:opacity-60"
        >
          {submitting ? "Posting…" : "Post"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PortalHeader({ tenantName, pmName }: { tenantName: string; pmName: string }) {
  return (
    <header className="bg-forge px-4 py-4">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-amber rounded-lg flex items-center justify-center shrink-0">
            <span className="font-display font-800 text-forge text-lg">
              {tenantName?.[0] ?? "F"}
            </span>
          </div>
          <div>
            <p className="font-display font-800 text-white text-lg leading-none tracking-wide">{tenantName || "Your contractor"}</p>
            <p className="text-mist text-xs">Managed by {tenantName || "your contractor"}</p>
          </div>
        </div>
        <p className="text-mist text-xs text-right">Hi, {pmName.split(" ")[0]}</p>
      </div>
    </header>
  );
}

// ─── Work Order Form ──────────────────────────────────────────────────────────

function WorkOrderForm({
  pmId,
  tenantId,
  tenantName,
  token,
  properties,
  onSubmitted,
  onPropertyAdded,
}: {
  pmId: string;
  tenantId: string;
  tenantName: string;
  token: string;
  properties: Property[];
  onSubmitted: () => void;
  onPropertyAdded: (p: Property) => void;
}) {
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [priority, setPriority]     = useState("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/portal/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        property_manager_id: pmId,
        tenant_id: tenantId,
        property_id: propertyId,
        title,
        description,
        priority,
      }),
    });

    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error ?? "Failed to submit. Please try again."); return; }
    onSubmitted();
  };

  // When properties list changes (e.g., PM adds one), preselect the first.
  useEffect(() => {
    if (properties.length && !propertyId) {
      setPropertyId(properties[0].id);
    }
  }, [properties, propertyId]);

  if (properties.length === 0) {
    return (
      <div className="space-y-3">
        <div className="bg-amber/10 border border-amber/30 rounded-xl p-4">
          <p className="text-sm font-700 text-forge mb-1">No properties on your account yet</p>
          <p className="text-sm text-steel">Add one below to start sending work orders.</p>
        </div>
        <PropertyCreate
          token={token}
          tenantName={tenantName}
          inline
          defaultOpen
          onCreated={onPropertyAdded}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {properties.length > 1 && (
        <div>
          <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">Property</label>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.address}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">Issue Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g. Broken gate latch at Pool Area"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber"
        />
      </div>

      <div>
        <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">Description *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          placeholder="Describe the issue in detail — location, what you observed, any safety concerns."
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-amber"
        />
      </div>

      <fieldset>
        <legend className="block text-xs font-700 text-mist uppercase tracking-wider mb-2">Priority</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "low",       label: "Low",       desc: "Non-urgent" },
            { value: "normal",    label: "Normal",    desc: "Standard" },
            { value: "urgent",    label: "Urgent",    desc: "Within 48hrs" },
            { value: "emergency", label: "Emergency", desc: "Safety issue" },
          ].map((p) => (
            <label
              key={p.value}
              className={`flex items-start gap-2 border-2 rounded-lg p-3 cursor-pointer transition-all ${
                priority === p.value ? "border-amber bg-amber/5" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="priority"
                value={p.value}
                checked={priority === p.value}
                onChange={() => setPriority(p.value)}
                className="mt-0.5 accent-amber"
              />
              <div>
                <p className="text-sm font-600 text-forge">{p.label}</p>
                <p className="text-xs text-mist">{p.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !title.trim() || !description.trim()}
        className="w-full bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 py-3 rounded-xl text-sm transition-colors"
      >
        {submitting ? "Submitting…" : "Submit Work Order"}
      </button>
    </form>
  );
}

// ─── Pay button ───────────────────────────────────────────────────────────────

function PayButton({ invoiceId, token }: { invoiceId: string; token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [allowACH, setAllowACH] = useState(true);
  const [allowTips, setAllowTips] = useState(false);
  const [tipAmount, setTipAmount] = useState("0");
  const [deposit, setDeposit] = useState("");

  const handlePay = async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/portal/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice_id: invoiceId,
        token,
        allowACH,
        allowTips,
        tipAmount: Number(tipAmount) || 0,
        amount: deposit ? Number(deposit) : null,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Could not create payment link."); return; }
    window.location.href = data.url;
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-2 flex-wrap text-xs">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={allowACH} onChange={(e) => setAllowACH(e.target.checked)} /> ACH
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={allowTips} onChange={(e) => setAllowTips(e.target.checked)} /> Tips
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={tipAmount}
          onChange={(e) => setTipAmount(e.target.value)}
          disabled={!allowTips}
          className="w-20 border border-gray-200 rounded px-2 py-1 text-xs disabled:bg-gray-50"
          placeholder="Tip"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={deposit}
          onChange={(e) => setDeposit(e.target.value)}
          className="w-24 border border-gray-200 rounded px-2 py-1 text-xs"
          placeholder="Deposit"
        />
      </div>
      <button
        onClick={handlePay}
        disabled={loading}
        className="bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 px-4 py-1.5 rounded-lg text-sm transition-colors"
      >
        {loading ? "…" : "Pay Now"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

type Tab = "home" | "work-orders" | "invoices";

export default function PortalDashboard({
  token,
  propertyManager,
  tenantName,
  properties,
  workOrders,
  invoices,
  comments,
  initialTab = "home",
  paidSuccess = false,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [showForm, setShowForm] = useState(properties.length === 0);
  const [recentlySubmitted, setRecentlySubmitted] = useState(false);
  const [propertiesState, setProperties] = useState<Property[]>(properties);
  const [commentsState, setComments] = useState<Comment[]>(comments);

  const deriveStatus = (wo: WorkOrder) => {
    if (wo.job_status === "completed") return "completed";
    if (wo.job_status === "in_progress" || wo.job_status === "scheduled") return "in_progress";
    return wo.status;
  };

  const openWOs   = workOrders.filter((w) => !["completed", "cancelled"].includes(deriveStatus(w)));
  const unpaidInv = invoices.filter((i) => ["sent", "overdue"].includes(i.status));
  const unpaidTotal = unpaidInv.reduce((s, i) => s + i.total, 0);
  const hasProperties = propertiesState.length > 0;

  const handleSubmitted = () => {
    setShowForm(false);
    setRecentlySubmitted(true);
    setTab("work-orders");
    setTimeout(() => setRecentlySubmitted(false), 4000);
  };

  const handlePropertyCreated = (p: Property) => {
    setProperties((prev) => [...prev, p]);
    setShowForm(true);
    setTab("work-orders");
  };

  return (
    <div className="min-h-screen bg-surface">
      <PortalHeader tenantName={tenantName} pmName={propertyManager.full_name} />

      {/* Tab nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10" aria-label="Portal sections">
        <div className="max-w-2xl mx-auto flex">
          {(["home", "work-orders", "invoices"] as Tab[]).map((t) => (
              <button
                key={t}
              onClick={() => { setTab(t); setShowForm(propertiesState.length === 0 ? true : false); }}
              className={`flex-1 py-3 text-sm font-600 transition-colors border-b-2 ${
                tab === t
                  ? "border-amber text-forge"
                  : "border-transparent text-mist hover:text-forge"
              }`}
            >
              {t === "home"     ? "Home"      : null}
              {t === "work-orders"  ? (
                <span className="flex items-center justify-center gap-1.5">
                  Work Orders
                  {openWOs.length > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 bg-amber text-forge text-[10px] font-800 rounded-full">
                      {openWOs.length}
                    </span>
                  )}
                </span>
              ) : null}
              {t === "invoices" ? (
                <span className="flex items-center justify-center gap-1.5">
                  Invoices
                  {unpaidInv.length > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-800 rounded-full">
                      {unpaidInv.length}
                    </span>
                  )}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-2xl mx-auto p-4 py-6 space-y-4">

        {!hasProperties && (
          <div className="bg-white border border-amber/30 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-sm font-700 text-forge">Welcome to your portal</p>
            <p className="text-sm text-steel">Add your first property to submit work orders and track invoices.</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { setTab("work-orders"); setShowForm(true); }}
                className="bg-amber text-forge font-700 text-sm px-4 py-2 rounded-lg"
              >
                Add property
              </button>
              <button
                onClick={() => setTab("invoices")}
                className="text-sm text-amber font-700"
              >
                View invoices →
              </button>
            </div>
          </div>
        )}

        {/* ── Overview ── */}
        {tab === "home" && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-mist uppercase tracking-wider font-600">Open Work Orders</p>
                <p className="font-display font-800 text-3xl text-forge mt-1">{openWOs.length}</p>
              </div>
              <div className={`rounded-xl border p-4 ${unpaidTotal > 0 ? "bg-red-50/50 border-red-200" : "bg-white border-gray-200"}`}>
                <p className="text-xs text-mist uppercase tracking-wider font-600">Amount Due</p>
                <p className={`font-display font-800 text-3xl mt-1 ${unpaidTotal > 0 ? "text-red-600" : "text-forge"}`}>
                  {formatCurrency(unpaidTotal)}
                </p>
              </div>
            </div>

            {/* Submit CTA */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-display font-700 text-lg text-forge">Submit a Work Order</h2>
              </div>
              <p className="text-sm text-mist mb-4">Report an issue or request maintenance at one of your properties.</p>
              {recentlySubmitted && (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4 font-600">
                  ✓ Work order submitted! {tenantName} has been notified.
                </div>
              )}
              {propertiesState.length === 0 && (
                <div className="bg-amber/10 border border-amber/30 rounded-lg px-3 py-2 text-sm text-amber font-600 mb-3">
                  No properties are linked to your account yet. Add one below to get started.
                </div>
              )}
              {showForm ? (
                <>
                  <WorkOrderForm
                    pmId={propertyManager.id}
                    tenantId={propertyManager.tenant_id}
                    tenantName={tenantName}
                    token={token}
                    properties={propertiesState}
                    onSubmitted={handleSubmitted}
                    onPropertyAdded={(p) => setProperties((prev) => [...prev, p])}
                  />
                  <button
                    onClick={() => setShowForm(false)}
                    className="mt-3 text-sm text-mist hover:text-forge transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full bg-amber hover:bg-amber-dark text-forge font-display font-700 py-3 rounded-xl text-sm transition-colors"
                >
                  + New Work Order
                </button>
              )}
            </div>

            {/* Recent work orders */}
            {workOrders.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-display font-700 text-base text-forge">Recent Work Orders</h2>
                  <button onClick={() => setTab("work-orders")} className="text-xs text-amber hover:underline font-600">
                    View all →
                  </button>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {workOrders.slice(0, 4).map((wo) => {
                    const s = WO_STATUS[wo.status] ?? WO_STATUS.pending;
                    const prop = Array.isArray(wo.properties) ? wo.properties[0] : wo.properties;
                    return (
                      <div key={wo.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-600 text-forge line-clamp-1">{wo.title}</p>
                          <span className={`badge shrink-0 text-xs ${s.bg} ${s.color}`}>{s.label}</span>
                        </div>
                        <p className="text-xs text-mist mt-0.5">
                          {prop?.name ?? ""}
                          {wo.created_at ? ` · ${formatDate(wo.created_at.split("T")[0])}` : ""}
                      {wo.job_status === "completed" && (
                        <p className="text-xs text-green-700 font-700 mt-1">Work completed</p>
                      )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Outstanding invoices */}
            {unpaidInv.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-display font-700 text-base text-forge">Outstanding Invoices</h2>
                  <button onClick={() => setTab("invoices")} className="text-xs text-amber hover:underline font-600">
                    View all →
                  </button>
                </div>
                <div className="bg-white rounded-xl border border-red-200 divide-y divide-gray-100">
                  {unpaidInv.slice(0, 3).map((inv) => {
                    const s = INV_STATUS[inv.status] ?? INV_STATUS.sent;
                    const job = Array.isArray(inv.jobs) ? inv.jobs[0] : inv.jobs;
                    return (
                      <div key={inv.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-600 text-forge">{inv.invoice_number}</p>
                          <p className="text-xs text-mist mt-0.5">
                            {job?.title ?? ""}
                            {inv.due_date ? ` · Due ${formatDate(inv.due_date)}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`badge text-xs ${s.bg} ${s.color}`}>{s.label}</span>
                          <p className="font-700 text-forge text-sm">{formatCurrency(inv.total)}</p>
                          <PayButton invoiceId={inv.id} token={token} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {/* ── Work Orders ── */}
        {tab === "work-orders" && (
          <>
            {recentlySubmitted && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 font-600">
                ✓ Work order submitted! {tenantName} has been notified.
              </div>
            )}

            {showForm ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-700 text-lg text-forge">New Work Order</h2>
                  <button onClick={() => setShowForm(false)} className="text-sm text-mist hover:text-forge transition-colors">
                    Cancel
                  </button>
                </div>
                <WorkOrderForm
                  pmId={propertyManager.id}
                  tenantId={propertyManager.tenant_id}
                  tenantName={tenantName}
                  token={token}
                  properties={propertiesState}
                  onSubmitted={handleSubmitted}
                  onPropertyAdded={(p) => setProperties((prev) => [...prev, p])}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="w-full bg-amber hover:bg-amber-dark text-forge font-display font-700 py-3 rounded-xl text-sm transition-colors"
              >
                + New Work Order
              </button>
            )}

            {workOrders.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-4xl mb-3">📋</p>
                <p className="font-display font-700 text-lg text-forge">No work orders yet</p>
                <p className="text-mist text-sm mt-1">Submit your first work order above.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {workOrders.map((wo) => {
                  const derived = deriveStatus(wo);
                  const s = WO_STATUS[derived] ?? WO_STATUS.pending;
                  const prop = Array.isArray(wo.properties) ? wo.properties[0] : wo.properties;
                  const woComments = commentsState.filter((c) => c.work_order_id === wo.id);
                  return (
                    <div key={wo.id} className="px-4 py-3.5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-600 text-forge leading-snug">{wo.title}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-mist">{PRIORITY_LABEL[wo.priority] ?? wo.priority}</span>
                          <span className={`badge text-xs ${s.bg} ${s.color}`}>{s.label}</span>
                        </div>
                      </div>
                      <p className="text-xs text-mist">
                        {prop?.name ? `${prop.name} · ` : ""}
                        {formatDate(wo.created_at.split("T")[0])}
                      </p>

                      {woComments.length > 0 && (
                        <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 mt-2 space-y-1">
                          {woComments.map((c) => (
                            <div key={c.id} className="text-xs text-steel flex items-start gap-2">
                              <span className="font-700 text-forge shrink-0">{c.property_managers?.full_name || "You"}:</span>
                              <div className="space-y-0.5">
                                <p>{c.message}</p>
                                <p className="text-[11px] text-mist">{formatDate(c.created_at.split("T")[0])}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <CommentForm
                        token={token}
                        workOrderId={wo.id}
                        onAdded={(c) => setComments((prev) => [...prev, c])}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Invoices ── */}
        {tab === "invoices" && (
          <>
            {paidSuccess && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 font-600">
                ✓ Payment received — thank you!
              </div>
            )}
            {invoices.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-4xl mb-3">💵</p>
                <p className="font-display font-700 text-lg text-forge">No invoices yet</p>
                <p className="text-mist text-sm mt-1">Invoices from {tenantName} will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => {
                  const s   = INV_STATUS[inv.status] ?? INV_STATUS.sent;
                  const job = Array.isArray(inv.jobs) ? inv.jobs[0] : inv.jobs;
                  const payable = ["sent", "overdue"].includes(inv.status);
                  return (
                    <div
                      key={inv.id}
                      className={`bg-white rounded-xl border p-4 ${
                        inv.status === "overdue" ? "border-red-200" : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="font-700 text-forge text-sm">{inv.invoice_number}</p>
                          {job?.title && <p className="text-xs text-mist mt-0.5">{job.title}</p>}
                        </div>
                        <span className={`badge text-xs ${s.bg} ${s.color}`}>{s.label}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-display font-800 text-2xl text-forge">{formatCurrency(inv.total)}</p>
                          {inv.due_date && (
                            <p className={`text-xs mt-0.5 ${inv.status === "overdue" ? "text-red-600 font-600" : "text-mist"}`}>
                              {inv.status === "overdue" ? "Overdue since " : "Due "}
                              {formatDate(inv.due_date)}
                            </p>
                          )}
                        </div>
                        {payable && <PayButton invoiceId={inv.id} token={token} />}
                        {inv.status === "paid" && (
                          <span className="text-xs text-green-700 font-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                            ✓ Paid
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <p className="text-center text-xs text-mist pt-2">
          Powered by Foreman · {tenantName}
        </p>

        <div className="mt-4">
          <PropertyCreate
              token={token}
              tenantName={tenantName}
              defaultOpen={propertiesState.length === 0}
              onCreated={handlePropertyCreated}
            />
          </div>
        </main>
      </div>
  );
}
