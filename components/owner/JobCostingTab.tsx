"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

const COST_TYPES = ["material", "subcontractor", "equipment", "other"] as const;
type CostType = typeof COST_TYPES[number];

interface Cost {
  id: string;
  type: CostType;
  description: string;
  amount: number;
  created_at: string;
}

const TYPE_LABELS: Record<CostType, string> = {
  material: "Material",
  subcontractor: "Subcontractor",
  equipment: "Equipment",
  other: "Other",
};

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber";

export default function JobCostingTab({
  jobId,
  revenue,
  laborCostEstimate,
}: {
  jobId: string;
  revenue: number;
  laborCostEstimate: number;
}) {
  const [costs, setCosts]     = useState<Cost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [type, setType]         = useState<CostType>("material");
  const [description, setDescription] = useState("");
  const [amount, setAmount]     = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/jobs/${jobId}/costs`)
      .then((r) => r.json())
      .then((d) => { setCosts(d.costs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [jobId]);

  const addCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;
    setSaving(true); setError("");

    const res = await fetch(`/api/jobs/${jobId}/costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, description: description.trim(), amount: Number(amount) }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || "Failed to add cost."); return; }
    setCosts((prev) => [...prev, data.cost]);
    setDescription(""); setAmount(""); setShowForm(false);
  };

  const deleteCost = async (costId: string) => {
    setDeleting(costId);
    const res = await fetch(`/api/jobs/${jobId}/costs/${costId}`, { method: "DELETE" });
    if (res.ok) setCosts((prev) => prev.filter((c) => c.id !== costId));
    setDeleting(null);
  };

  const totalDirectCosts = costs.reduce((s, c) => s + c.amount, 0);
  const totalCosts = totalDirectCosts + laborCostEstimate;
  const margin = revenue > 0 ? ((revenue - totalCosts) / revenue) * 100 : null;

  if (loading) return <p className="text-sm text-mist py-4">Loading costs…</p>;

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Revenue", value: formatCurrency(revenue), highlight: false },
          { label: "Labor (est.)", value: formatCurrency(laborCostEstimate), highlight: false },
          { label: "Direct Costs", value: formatCurrency(totalDirectCosts), highlight: false },
          {
            label: "Margin",
            value: margin != null ? `${margin.toFixed(1)}%` : "—",
            highlight: true,
            positive: margin != null && margin >= 20,
            negative: margin != null && margin < 0,
          },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl border p-3 ${
            card.highlight
              ? (card.negative ? "bg-red-50 border-red-200" : card.positive ? "bg-green-50 border-green-200" : "bg-white border-gray-200")
              : "bg-white border-gray-200"
          }`}>
            <p className="text-[11px] font-600 text-mist uppercase tracking-wider">{card.label}</p>
            <p className={`font-display font-800 text-xl mt-1 ${
              card.highlight
                ? (card.negative ? "text-red-600" : card.positive ? "text-green-700" : "text-forge")
                : "text-forge"
            }`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Labor note */}
      {laborCostEstimate > 0 && (
        <p className="text-xs text-mist">Labor estimate based on tracked time × worker hourly rates.</p>
      )}

      {/* Cost lines */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-600 text-forge text-sm">Direct Costs</h3>
          <button
            onClick={() => setShowForm((p) => !p)}
            className="text-sm text-amber font-600 hover:underline"
          >
            {showForm ? "Cancel" : "+ Add Cost"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={addCost} className="p-4 border-b border-gray-100 bg-gray-50 space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Type</label>
                <select value={type} onChange={(e) => setType(e.target.value as CostType)} className={inp}>
                  {COST_TYPES.map((t) => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Description *</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Lumber — 2x4s" className={inp} required />
              </div>
              <div>
                <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Amount *</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="0" step="0.01" placeholder="0.00" className={inp} required />
              </div>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="submit" disabled={saving || !description.trim() || !amount} className="bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-700 text-sm px-4 py-2 rounded-lg transition-colors">
              {saving ? "Saving…" : "Add Cost"}
            </button>
          </form>
        )}

        {costs.length === 0 ? (
          <p className="text-sm text-mist text-center py-6">No direct costs logged yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2 font-600 text-mist text-xs uppercase">Type</th>
                <th className="text-left px-4 py-2 font-600 text-mist text-xs uppercase">Description</th>
                <th className="text-right px-4 py-2 font-600 text-mist text-xs uppercase">Amount</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {costs.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5">
                    <span className="inline-block bg-gray-100 text-gray-600 text-xs font-600 px-2 py-0.5 rounded">
                      {TYPE_LABELS[c.type]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-forge">{c.description}</td>
                  <td className="px-4 py-2.5 text-right font-600 text-forge">{formatCurrency(c.amount)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => deleteCost(c.id)}
                      disabled={deleting === c.id}
                      className="text-mist hover:text-red-500 transition-colors text-xs disabled:opacity-50"
                      aria-label="Delete cost"
                    >
                      {deleting === c.id ? "…" : "✕"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200">
                <td colSpan={2} className="px-4 py-2.5 text-right font-600 text-forge text-sm">Total Direct Costs</td>
                <td className="px-4 py-2.5 text-right font-display font-800 text-forge">{formatCurrency(totalDirectCosts)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
