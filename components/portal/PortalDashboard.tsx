"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import PhotoLightbox from "@/components/ui/PhotoLightbox";

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
  property_manager_id?: string | null;
}

interface WorkOrderPhoto {
  url: string;
  caption?: string | null;
  created_at: string;
  uploaded_by_pm_id: string;
  source?: "submission" | "comment";
  comment_id?: string;
}

interface WorkOrder {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  properties?: { name: string } | null;
  photos?: WorkOrderPhoto[] | null;
  job_status?: string | null;
  job_scheduled_date?: string | null;
  job_scheduled_time?: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  total: number;
  subtotal?: number | null;
  tax_rate?: number | null;
  tax_amount?: number | null;
  due_date: string | null;
  created_at: string;
  notes?: string | null;
  line_items?: any[] | null;
  jobs?: { title: string } | null;
}

interface Estimate {
  id: string;
  estimate_number: string;
  status: string;
  total: number;
  title: string;
  created_at: string;
  approval_token?: string | null;
}

interface Comment {
  id: string;
  work_order_id: string;
  message: string;
  created_at: string;
  property_manager?: { full_name?: string };
}

interface Props {
  propertyManager: PropertyManager;
  tenantName: string;
  properties: Property[];
  workOrders: WorkOrder[];
  invoices: Invoice[];
  comments: Comment[];
  estimates: Estimate[];
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

const EST_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  draft:     { label: "Draft",     bg: "bg-gray-100",   color: "text-gray-500" },
  sent:      { label: "Sent",      bg: "bg-blue-100",   color: "text-blue-800" },
  approved:  { label: "Approved",  bg: "bg-green-100",  color: "text-green-800" },
  declined:  { label: "Declined",  bg: "bg-red-100",    color: "text-red-700" },
  converted: { label: "Converted", bg: "bg-amber-100",  color: "text-amber-800" },
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Low", normal: "Normal", urgent: "Urgent", emergency: "Emergency",
};

function PropertiesPanel({ properties }: { properties: Property[] }) {
  if (properties.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display font-700 text-base text-forge">Your Properties</h2>
        <p className="text-xs font-600 text-mist">{properties.length} linked</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {properties.map((property) => (
          <div key={property.id} className="px-4 py-3">
            <p className="text-sm font-600 text-forge">{property.name}</p>
            <p className="text-xs text-mist mt-0.5">
              {property.address}, {property.city}, {property.state}
              {property.zip ? ` ${property.zip}` : ""}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PhotoGrid({ photos }: { photos: WorkOrderPhoto[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <>
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos.map((p) => ({ url: p.url, caption: p.caption }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChange={setLightboxIndex}
        />
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((photo, i) => (
          <button
            key={`${photo.url}-${photo.created_at}`}
            type="button"
            onClick={() => setLightboxIndex(i)}
            className="group overflow-hidden rounded-lg border border-gray-200 bg-white text-left focus:outline-none focus:ring-2 focus:ring-amber"
          >
            <Image
              src={photo.url}
              alt={photo.caption || "Work order photo"}
              width={448}
              height={224}
              sizes="(max-width: 640px) 50vw, 33vw"
              className="h-28 w-full object-cover transition-transform group-hover:scale-[1.02]"
            />
            {photo.caption && <p className="px-2 py-1.5 text-[11px] text-mist line-clamp-1">{photo.caption}</p>}
          </button>
        ))}
      </div>
    </>
  );
}

function PropertyCreate({
  tenantName,
  defaultOpen = false,
  inline = false,
  onCreated,
}: {
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
      body: JSON.stringify({ name, address, city, state, zip, notes }),
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
function CommentForm({
  workOrderId,
  onAdded,
}: {
  workOrderId: string;
  onAdded: (comment: Comment, photos: WorkOrderPhoto[]) => void;
}) {
  const [message, setMessage] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [pickerKey, setPickerKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!message.trim()) return;
    setSubmitting(true); setError("");
    const formData = new FormData();
    formData.append("work_order_id", workOrderId);
    formData.append("message", message.trim());
    for (const file of photoFiles) {
      formData.append("photos", file);
    }
    const res = await fetch("/api/portal/comments", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error || "Failed to add comment"); return; }
    onAdded(data.comment, data.photos ?? []);
    setMessage("");
    setPhotoFiles([]);
    setPickerKey((prev) => prev + 1);
  };

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs"
        placeholder="Add a comment…"
      />
      <div className="space-y-1">
        <label className="block text-[11px] font-700 uppercase tracking-wider text-mist">Photos</label>
        <input
          key={pickerKey}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          onChange={(e) => setPhotoFiles(Array.from(e.target.files ?? []))}
          className="block w-full text-xs text-mist file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:font-700 file:text-forge"
        />
        {photoFiles.length > 0 && <p className="text-[11px] text-mist">{photoFiles.length} photo{photoFiles.length === 1 ? "" : "s"} ready to send</p>}
      </div>
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
    <header className="bg-forge px-4 py-4 shadow-sm">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber rounded-lg flex items-center justify-center shrink-0">
            <span className="font-display font-800 text-forge text-lg leading-none">
              {tenantName?.[0]?.toUpperCase() ?? "F"}
            </span>
          </div>
          <div>
            <p className="font-display font-800 text-white text-lg leading-none tracking-wide">{tenantName || "Your Contractor"}</p>
            <p className="text-white/50 text-xs mt-0.5">Client Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-white text-sm font-600">Hi, {pmName.split(" ")[0]}</p>
            <p className="text-white/40 text-xs">Property Manager</p>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="text-white/40 hover:text-white/80 transition-colors p-1"
              title="Sign out"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

// ─── Work Order Form ──────────────────────────────────────────────────────────

function WorkOrderForm({
  tenantName,
  properties,
  onSubmitted,
  onPropertyAdded,
}: {
  tenantName: string;
  properties: Property[];
  onSubmitted: (wo: WorkOrder) => void;
  onPropertyAdded: (p: Property) => void;
}) {
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [priority, setPriority]     = useState("normal");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [pickerKey, setPickerKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const formData = new FormData();
    formData.append("property_id", propertyId);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("priority", priority);
    for (const file of photoFiles) {
      formData.append("photos", file);
    }

    const res = await fetch("/api/portal/submit", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error ?? "Failed to submit. Please try again."); return; }
    onSubmitted(data.workOrder);
    setTitle("");
    setDescription("");
    setPriority("normal");
    setPhotoFiles([]);
    setPickerKey((prev) => prev + 1);
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
      {properties.length === 1 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
          <p className="text-[11px] font-700 uppercase tracking-wider text-mist">Property</p>
          <p className="mt-1 text-sm font-600 text-forge">{properties[0].name}</p>
          <p className="text-xs text-mist mt-0.5">
            {properties[0].address}, {properties[0].city}, {properties[0].state}
            {properties[0].zip ? ` ${properties[0].zip}` : ""}
          </p>
        </div>
      )}

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

      <div>
        <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">Photos</label>
        <input
          key={pickerKey}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          onChange={(e) => setPhotoFiles(Array.from(e.target.files ?? []))}
          className="block w-full text-xs text-mist file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:font-700 file:text-forge"
        />
        <p className="mt-1 text-[11px] text-mist">Attach photos of the issue if helpful.</p>
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

function PayButton({ invoiceId }: { invoiceId: string }) {
  return (
    <a
      href={`/portal/invoice?invoice=${encodeURIComponent(invoiceId)}`}
      className="inline-block bg-amber hover:bg-amber-dark text-forge font-display font-700 px-4 py-1.5 rounded-lg text-sm transition-colors"
    >
      Pay Now
    </a>
  );
}

// ─── Invoice Card ─────────────────────────────────────────────────────────────

function InvoiceCard({
  inv, s, job, payable, items,
}: {
  inv: Invoice;
  s: { label: string; bg: string; color: string };
  job: { title: string } | null | undefined;
  payable: boolean;
  items: any[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${inv.status === "overdue" ? "border-red-200" : "border-gray-200"}`}>
      {/* Header row */}
      <div className="p-4">
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
          <div className="flex items-center gap-2 flex-col sm:flex-row">
            {items.length > 0 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-amber font-600 hover:underline"
              >
                {expanded ? "Hide details" : "View details"}
              </button>
            )}
            {payable && <PayButton invoiceId={inv.id} />}
            {inv.status === "paid" && (
              <span className="text-xs text-green-700 font-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                ✓ Paid
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expandable line items */}
      {expanded && items.length > 0 && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-mist">
                <th className="text-left pb-1.5 font-600 uppercase tracking-wider">Description</th>
                <th className="text-right pb-1.5 font-600 uppercase tracking-wider">Qty</th>
                <th className="text-right pb-1.5 font-600 uppercase tracking-wider">Unit</th>
                <th className="text-right pb-1.5 font-600 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item: any, i: number) => (
                <tr key={i}>
                  <td className="py-1.5 text-forge">{item.description}</td>
                  <td className="py-1.5 text-right text-mist">{item.quantity}</td>
                  <td className="py-1.5 text-right text-mist">{formatCurrency(item.unit_price)}</td>
                  <td className="py-1.5 text-right font-600 text-forge">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
            {(inv.tax_rate ?? 0) > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-2 text-right text-mist">Subtotal</td>
                  <td className="pt-2 text-right text-mist">{formatCurrency(inv.subtotal ?? 0)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="text-right text-mist">Tax ({inv.tax_rate}%)</td>
                  <td className="text-right text-mist">{formatCurrency(inv.tax_amount ?? 0)}</td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td colSpan={3} className="pt-2 text-right font-700 text-forge">Total</td>
                  <td className="pt-2 text-right font-700 text-forge">{formatCurrency(inv.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          {inv.notes && (
            <p className="mt-3 text-xs text-steel bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">{inv.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

type Tab = "home" | "work-orders" | "invoices" | "estimates";

export default function PortalDashboard({
  propertyManager,
  tenantName,
  properties,
  workOrders,
  invoices,
  comments,
  estimates,
  initialTab = "home",
  paidSuccess = false,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [showForm, setShowForm] = useState(properties.length === 0);
  const [recentlySubmitted, setRecentlySubmitted] = useState(false);
  const [propertiesState, setProperties] = useState<Property[]>(properties);
  const [commentsState, setComments] = useState<Comment[]>(comments);
  const [estimatesState] = useState<Estimate[]>(estimates);
  const [workOrdersState, setWorkOrdersState] = useState<WorkOrder[]>(workOrders);
  const [showPastWO, setShowPastWO]   = useState(false);
  const [showPastInv, setShowPastInv] = useState(false);
  const [showPastEst, setShowPastEst] = useState(false);

  const deriveStatus = (wo: WorkOrder): string => {
    if (wo.job_status === "completed") return "completed";
    if (wo.job_status === "in_progress" || wo.job_status === "scheduled") return "in_progress";
    return wo.status;
  };

  const openWOs   = workOrdersState.filter((w) => !["completed", "cancelled"].includes(deriveStatus(w)));
  const unpaidInv = invoices.filter((i) => ["sent", "overdue"].includes(i.status));
  const unpaidTotal = unpaidInv.reduce((s, i) => s + i.total, 0);
  const hasProperties = propertiesState.length > 0;
  const now = Date.now();
  const toMs = (days: number) => days * 24 * 60 * 60 * 1000;
  const isOld = (dateStr: string, days: number) => (now - new Date(dateStr).getTime()) > toMs(days);
  const woPast = workOrdersState.filter((w) => ["accepted", "declined", "completed"].includes(deriveStatus(w)) && isOld(w.created_at, 14));
  const invPast = invoices.filter((i) => i.status === "paid" && isOld(i.created_at, 30));
  const estPast = estimatesState.filter((e) => ["approved", "declined", "converted"].includes(e.status) && isOld(e.created_at, 7));
  const woActive = workOrdersState.filter((w) => !woPast.includes(w));
  const invActive = invoices.filter((i) => !invPast.includes(i));
  const estActive = estimatesState.filter((e) => !estPast.includes(e));

  const handleSubmitted = (wo: WorkOrder) => {
    if (wo) setWorkOrdersState((prev) => [wo, ...prev]);
    setShowForm(false);
    setRecentlySubmitted(true);
    setTab("work-orders");
    setTimeout(() => setRecentlySubmitted(false), 4000);
  };


  return (
    <div className="min-h-screen bg-surface">
      <PortalHeader tenantName={tenantName} pmName={propertyManager.full_name} />

      {/* Tab nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10" aria-label="Portal sections">
        <div className="max-w-2xl mx-auto flex">
          {(["home", "work-orders", "invoices", "estimates"] as Tab[]).map((t) => (
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

        {!hasProperties && tab !== "work-orders" && (
          <div className="bg-amber/10 border border-amber/30 rounded-xl p-4">
            <p className="text-sm font-700 text-forge mb-1">Welcome to your portal</p>
            <p className="text-sm text-steel mb-3">Add your first property under <strong>Work Orders</strong> to start submitting requests.</p>
            <button
              onClick={() => { setTab("work-orders"); setShowForm(true); }}
              className="bg-amber text-forge font-700 text-sm px-4 py-2 rounded-lg"
            >
              Get started →
            </button>
          </div>
        )}

        {/* ── Overview ── */}
        {tab === "home" && (
          <>
            {hasProperties && <PropertiesPanel properties={propertiesState} />}

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
              <h2 className="font-display font-700 text-lg text-forge mb-1">Submit a Work Order</h2>
              <p className="text-sm text-mist mb-4">Report an issue or request maintenance at one of your properties.</p>
              {recentlySubmitted && (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3 font-600">
                  ✓ Work order submitted! {tenantName} has been notified.
                </div>
              )}
              <button
                onClick={() => { setTab("work-orders"); setShowForm(true); }}
                className="w-full bg-amber hover:bg-amber-dark text-forge font-display font-700 py-3 rounded-xl text-sm transition-colors"
              >
                + New Work Order
              </button>
            </div>

            {/* Recent work orders */}
            {workOrdersState.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-display font-700 text-base text-forge">Recent Work Orders</h2>
                  <button onClick={() => setTab("work-orders")} className="text-xs text-amber hover:underline font-600">
                    View all →
                  </button>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {workOrdersState.slice(0, 4).map((wo) => {
                    const s = WO_STATUS[wo.status] ?? WO_STATUS.pending;
                    const prop = Array.isArray(wo.properties) ? wo.properties[0] : wo.properties;
                    return (
                      <div key={wo.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-600 text-forge line-clamp-1">{wo.title}</p>
                          <span className={`badge shrink-0 text-xs ${s.bg} ${s.color}`}>{s.label}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-mist">
                          {prop?.name ?? ""}
                          {wo.created_at ? ` · ${formatDate(wo.created_at.split("T")[0])}` : ""}
                          {wo.job_status === "completed" && (
                            <p className="mt-1 text-xs font-700 text-green-700">Work completed</p>
                          )}
                        </div>
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
                          <PayButton invoiceId={inv.id} />
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
            {hasProperties && <PropertiesPanel properties={propertiesState} />}

            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-700 text-forge">Work Orders</h2>
              <button
                onClick={() => setShowPastWO((p) => !p)}
                className="text-xs text-amber font-700 hover:underline"
              >
                {showPastWO ? "Hide past" : "Show past"}
              </button>
            </div>
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
                  tenantName={tenantName}
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

            {(showPastWO ? workOrdersState : woActive).length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <p className="font-display font-700 text-lg text-forge">No work orders yet</p>
                <p className="text-mist text-sm mt-1">Submit your first work order above.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {(showPastWO ? workOrdersState : woActive).map((wo) => {
                  const derived = deriveStatus(wo);
                  const s = WO_STATUS[derived] ?? WO_STATUS.pending;
                  const prop = Array.isArray(wo.properties) ? wo.properties[0] : wo.properties;
                  const woComments = commentsState.filter((c) => c.work_order_id === wo.id);
                  const allPhotos = Array.isArray(wo.photos) ? wo.photos : [];
                  const submissionPhotos = allPhotos.filter((photo) => !photo.comment_id && photo.source !== "comment");
                  const showSchedule = wo.job_scheduled_date && ["accepted", "in_progress", "completed"].includes(derived);
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
                      {showSchedule && (
                        <p className="text-xs text-blue-700 font-600 mt-1">
                          Scheduled: {formatDate(wo.job_scheduled_date!)}
                          {wo.job_scheduled_time ? ` at ${wo.job_scheduled_time.slice(0, 5)}` : ""}
                        </p>
                      )}

                      {submissionPhotos.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-[11px] font-700 uppercase tracking-wider text-mist">Submitted Photos</p>
                          <PhotoGrid photos={submissionPhotos} />
                        </div>
                      )}

                      {woComments.length > 0 && (
                        <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 mt-2 space-y-1">
                          {woComments.map((c) => (
                            <div key={c.id} className="text-xs text-steel flex items-start gap-2">
                              <span className="font-700 text-forge shrink-0">{c.property_manager?.full_name || "You"}:</span>
                              <div className="min-w-0 flex-1 space-y-1">
                                <p>{c.message}</p>
                                <p className="text-[11px] text-mist">{formatDate(c.created_at.split("T")[0])}</p>
                                <PhotoGrid photos={allPhotos.filter((photo) => photo.comment_id === c.id)} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <CommentForm
                        workOrderId={wo.id}
                        onAdded={(comment, photos) => {
                          setComments((prev) => [...prev, comment]);
                          if (photos.length > 0) {
                            setWorkOrdersState((prev) => prev.map((item) => (
                              item.id === wo.id
                                ? { ...item, photos: [...(Array.isArray(item.photos) ? item.photos : []), ...photos] }
                                : item
                            )));
                          }
                        }}
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-700 text-forge">Invoices</h2>
              <button
                onClick={() => setShowPastInv((p) => !p)}
                className="text-xs text-amber font-700 hover:underline"
              >
                {showPastInv ? "Hide past" : "Show past"}
              </button>
            </div>
            {paidSuccess && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 font-600">
                ✓ Payment received — thank you!
              </div>
            )}
            {(showPastInv ? invoices : invActive).length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="font-display font-700 text-lg text-forge">No invoices yet</p>
                <p className="text-mist text-sm mt-1">Invoices from {tenantName} will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(showPastInv ? invoices : invActive).map((inv) => {
                  const s        = INV_STATUS[inv.status] ?? INV_STATUS.sent;
                  const job      = Array.isArray(inv.jobs) ? inv.jobs[0] : inv.jobs;
                  const payable  = ["sent", "overdue"].includes(inv.status);
                  const items: any[] = Array.isArray(inv.line_items) ? inv.line_items : [];
                  return (
                    <InvoiceCard
                      key={inv.id}
                      inv={inv}
                      s={s}
                      job={job}
                      payable={payable}
                      items={items}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Estimates ── */}
        {tab === "estimates" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-700 text-forge">Estimates</h2>
              <button
                onClick={() => setShowPastEst((p) => !p)}
                className="text-xs text-amber font-700 hover:underline"
              >
                {showPastEst ? "Hide past" : "Show past"}
              </button>
            </div>
            {(showPastEst ? estimatesState : estActive).length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M15 11H9m6 4H9" /></svg>
                </div>
                <p className="font-display font-700 text-lg text-forge">No estimates yet</p>
                <p className="text-mist text-sm mt-1">Your contractor hasn’t sent you any estimates.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(showPastEst ? estimatesState : estActive).map((est) => {
                  const s = EST_STATUS[est.status] ?? EST_STATUS.draft;
                  const needsAction = est.status === "sent";
                  return (
                    <div key={est.id} className={`bg-white rounded-xl border p-4 ${needsAction ? "border-amber" : "border-gray-200"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-mist">#{est.estimate_number} &middot; {formatDate(est.created_at.split("T")[0])}</p>
                          <p className="font-700 text-forge line-clamp-1 mt-0.5">{est.title}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-600 ${s.bg} ${s.color}`}>
                              {s.label}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-700 text-forge">{formatCurrency(est.total)}</p>
                          {needsAction ? (
                            <a
                              href={`/portal/estimate?token=${est.approval_token ?? ""}`}
                              className="mt-2 inline-block bg-forge hover:bg-forge-light text-white text-xs font-700 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Review &amp; Sign →
                            </a>
                          ) : est.status === "approved" ? (
                            <p className="text-xs text-green-700 font-600 mt-1.5">Approved</p>
                          ) : null}
                        </div>
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
      </main>
    </div>
);
}
