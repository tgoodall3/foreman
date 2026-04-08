"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContainer";

export default function PropertiesClient({ propertyManagers: initial, tenantId, appUrl }: any) {
  const { addToast } = useToast();
  const [pms, setPms] = useState(initial);
  const [view, setView] = useState<"list" | "add-pm" | "add-property">("list");
  const [selectedPm, setSelectedPm] = useState<any>(null);
  const [copiedToken, setCopiedToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // PM form
  const [pmName, setPmName]       = useState("");
  const [pmEmail, setPmEmail]     = useState("");
  const [pmPhone, setPmPhone]     = useState("");
  const [pmCompany, setPmCompany] = useState("");

  // Property form
  const [propName, setPropName]     = useState("");
  const [propAddress, setPropAddress] = useState("");
  const [propCity, setPropCity]     = useState("");
  const [propState, setPropState]   = useState("");
  const [propZip, setPropZip]       = useState("");
  const [propNotes, setPropNotes]   = useState("");

  const portalLink = (token: string) => `${appUrl}/portal?token=${token}`;

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(portalLink(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(""), 2000);
  };

  const handleAddPm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError("");
    const res = await fetch("/api/properties/add-pm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, fullName: pmName, email: pmEmail, phone: pmPhone, company: pmCompany }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSubmitting(false); return; }
    setPms((prev: any[]) => [{ ...data.pm, properties: [] }, ...prev]);
    setPmName(""); setPmEmail(""); setPmPhone(""); setPmCompany("");
    setView("list");
    addToast("Property manager added successfully.", "success");
    setSubmitting(false);
  };

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPm) return;
    setSubmitting(true); setError("");
    const res = await fetch("/api/properties/add-property", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, propertyManagerId: selectedPm.id, name: propName, address: propAddress, city: propCity, state: propState, zip: propZip, notes: propNotes }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSubmitting(false); return; }
    setPms((prev: any[]) => prev.map((pm: any) => pm.id === selectedPm.id ? { ...pm, properties: [...pm.properties, data.property] } : pm));
    setPropName(""); setPropAddress(""); setPropCity(""); setPropState(""); setPropZip(""); setPropNotes("");
    setView("list");
    addToast("Property added successfully.", "success");
    setSubmitting(false);
  };

  const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber";

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="font-display font-800 text-2xl sm:text-3xl text-forge">Properties & Managers</h1>
          <p className="text-mist text-sm mt-1">{pms.length} property managers</p>
        </div>
        <button onClick={() => { setView("add-pm"); setError(""); }}
          className="w-full sm:w-auto bg-amber hover:bg-amber-dark text-forge font-display font-700 px-4 py-2.5 rounded-lg text-sm transition-colors min-h-[44px]">
          + Add Property Manager
        </button>
      </div>

      {/* Add PM form */}
      {view === "add-pm" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-display font-700 text-lg text-forge mb-4">Add Property Manager</h2>
          <form onSubmit={handleAddPm} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Full Name *</label>
              <input value={pmName} onChange={(e) => setPmName(e.target.value)} required className={inp} placeholder="Jane Smith" /></div>
            <div><label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Email *</label>
              <input type="email" value={pmEmail} onChange={(e) => setPmEmail(e.target.value)} required className={inp} placeholder="jane@realty.com" /></div>
            <div><label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Phone</label>
              <input type="tel" value={pmPhone} onChange={(e) => setPmPhone(e.target.value)} className={inp} placeholder="(555) 000-0000" /></div>
            <div><label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Company</label>
              <input value={pmCompany} onChange={(e) => setPmCompany(e.target.value)} className={inp} placeholder="Acme Property Management" /></div>
            {error && <div className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            <div className="col-span-1 sm:col-span-2 flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={() => setView("list")} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-600 hover:bg-gray-50 order-2 sm:order-1">Cancel</button>
              <button type="submit" disabled={submitting || !pmName || !pmEmail} className="px-4 py-2 bg-forge text-white rounded-lg text-sm font-display font-700 disabled:opacity-50 hover:bg-forge-light transition-colors order-1 sm:order-2">
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Adding…
                  </div>
                ) : (
                  "Add Manager"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Property form */}
      {view === "add-property" && selectedPm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-display font-700 text-lg text-forge mb-1">Add Property</h2>
          <p className="text-sm text-mist mb-4">For: {selectedPm.full_name}</p>
          <form onSubmit={handleAddProperty} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2"><label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Property Name *</label>
              <input value={propName} onChange={(e) => setPropName(e.target.value)} required className={inp} placeholder="Sunset Ridge Apartments" /></div>
            <div className="col-span-2"><label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Street Address *</label>
              <input value={propAddress} onChange={(e) => setPropAddress(e.target.value)} required className={inp} placeholder="123 Main St" /></div>
            <div><label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">City *</label>
              <input value={propCity} onChange={(e) => setPropCity(e.target.value)} required className={inp} placeholder="Indianapolis" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">State *</label>
                <input value={propState} onChange={(e) => setPropState(e.target.value)} required maxLength={2} className={inp} placeholder="IN" /></div>
              <div><label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">ZIP *</label>
                <input value={propZip} onChange={(e) => setPropZip(e.target.value)} required className={inp} placeholder="46240" /></div>
            </div>
            <div className="col-span-2"><label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Notes</label>
              <textarea value={propNotes} onChange={(e) => setPropNotes(e.target.value)} rows={2} className={inp + " resize-none"} placeholder="Gate code, parking, special instructions…" /></div>
            {error && <div className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            <div className="col-span-1 sm:col-span-2 flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={() => setView("list")} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-600 hover:bg-gray-50 order-2 sm:order-1">Cancel</button>
              <button type="submit" disabled={submitting || !propName || !propAddress || !propCity || !propState || !propZip}
                className="px-4 py-2 bg-forge text-white rounded-lg text-sm font-display font-700 disabled:opacity-50 hover:bg-forge-light transition-colors order-1 sm:order-2">
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Adding…
                  </div>
                ) : (
                  "Add Property"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PM List */}
      {pms.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">🏢</p>
          <p className="font-display font-700 text-xl text-forge mb-1">No property managers yet</p>
          <p className="text-mist text-sm">Add a property manager to generate their portal link.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pms.map((pm: any) => (
            <div key={pm.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100">
                <div>
                  <p className="font-600 text-forge">{pm.full_name}</p>
                  <p className="text-xs text-mist">{pm.email}{pm.company && ` · ${pm.company}`}</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => copyLink(pm.portal_token)}
                    className="text-xs bg-amber/10 hover:bg-amber/20 text-amber-dark font-600 px-3 py-1.5 rounded-lg transition-colors min-h-[32px]"
                    aria-label={`Copy portal link for ${pm.full_name}`}
                  >
                    {copiedToken === pm.portal_token ? "✓ Copied!" : "Copy Portal Link"}
                  </button>
                  <button
                    onClick={() => { setSelectedPm(pm); setView("add-property"); setError(""); }}
                    className="text-xs bg-forge/10 hover:bg-forge/20 text-forge font-600 px-3 py-1.5 rounded-lg transition-colors min-h-[32px]"
                  >
                    + Property
                  </button>
                </div>
              </div>
              {pm.properties?.length > 0 ? (
                <ul className="divide-y divide-gray-50">
                  {pm.properties.map((prop: any) => (
                    <li key={prop.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-500 text-forge">{prop.name}</p>
                        <p className="text-xs text-mist">{prop.address}, {prop.city}, {prop.state} {prop.zip}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-5 py-3 text-xs text-mist italic">No properties yet — add one above</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
