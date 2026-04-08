"use client";

import { useState } from "react";

interface ChecklistItem {
  id: string;
  text: string;
  position: number;
  done: boolean;
  done_at?: string | null;
  profiles?: { full_name: string } | null;
}

interface Props {
  jobId:      string;
  items:      ChecklistItem[];
  canManage:  boolean;   // true for owners — can add/delete items
}

export default function JobChecklist({ jobId, items: initial, canManage }: Props) {
  const [items, setItems]     = useState<ChecklistItem[]>(
    [...initial].sort((a, b) => a.position - b.position)
  );
  const [newText, setNewText] = useState("");
  const [adding, setAdding]   = useState(false);
  const [error, setError]     = useState("");

  const doneCount = items.filter((i) => i.done).length;
  const pct       = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  const toggle = async (item: ChecklistItem) => {
    const next = !item.done;
    // Optimistic update
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, done: next } : i));

    const res = await fetch(`/api/jobs/${jobId}/checklist`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ itemId: item.id, done: next }),
    });
    if (!res.ok) {
      // Revert on failure
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, done: item.done } : i));
      setError("Failed to update item.");
    }
  };

  const addItem = async () => {
    if (!newText.trim()) return;
    setAdding(true); setError("");

    const res = await fetch(`/api/jobs/${jobId}/checklist`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text: newText.trim() }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) { setError(data.error || "Failed to add item."); return; }

    setItems((prev) => [...prev, data.item]);
    setNewText("");
  };

  const deleteItem = async (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    const res = await fetch(`/api/jobs/${jobId}/checklist`, {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ itemId }),
    });
    if (!res.ok) setError("Failed to delete item.");
  };

  return (
    <div>
      {/* Progress bar */}
      {items.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-mist">{doneCount} of {items.length} done</span>
            <span className="text-xs font-600 text-forge">{pct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Items */}
      <div className="space-y-2">
        {items.length === 0 && !canManage && (
          <p className="text-sm text-mist">No checklist items for this job.</p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 group"
          >
            <button
              onClick={() => toggle(item)}
              className={`mt-0.5 w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                item.done
                  ? "bg-green-500 border-green-500 text-white"
                  : "border-gray-300 hover:border-green-400"
              }`}
              aria-label={item.done ? "Mark incomplete" : "Mark complete"}
            >
              {item.done && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            <div className="flex-1 min-w-0">
              <p className={`text-sm leading-snug ${item.done ? "line-through text-mist" : "text-forge"}`}>
                {item.text}
              </p>
              {item.done && item.profiles?.full_name && (
                <p className="text-xs text-mist mt-0.5">{item.profiles.full_name}</p>
              )}
            </div>

            {canManage && (
              <button
                onClick={() => deleteItem(item.id)}
                className="opacity-0 group-hover:opacity-100 text-mist hover:text-red-500 transition-all p-1 shrink-0"
                aria-label="Remove item"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add item (owner only) */}
      {canManage && (
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="Add a checklist item…"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber"
          />
          <button
            onClick={addItem}
            disabled={adding || !newText.trim()}
            className="px-3 py-2 bg-forge hover:bg-forge-light disabled:opacity-40 text-white rounded-lg text-sm font-600 transition-colors"
          >
            {adding ? "…" : "Add"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
