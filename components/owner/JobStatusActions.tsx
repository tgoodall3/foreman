"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastContainer";
import Link from "next/link";

const transitions: Record<string, { label: string; next: string }[]> = {
  pending: [
    { label: "Start Job", next: "in_progress" },
    { label: "Mark Complete", next: "completed" },
  ],
  scheduled: [
    { label: "Start Job", next: "in_progress" },
    { label: "Mark Complete", next: "completed" },
  ],
  in_progress: [{ label: "Mark Complete", next: "completed" }],
};

export default function JobStatusActions({ jobId, status, hasInvoice }: { jobId: string; status: string; hasInvoice?: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const { addToast } = useToast();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [showInvoicePrompt, setShowInvoicePrompt] = useState(false);

  const options = transitions[status] || [];
  if (!options.length) return null;

  const updateStatus = async (next: string) => {
    setUpdating(true);
    setError("");
    const { error: err } = await supabase
      .from("jobs")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    if (err) {
      addToast("Failed to update status", "error");
      setError("Failed to update status");
      setUpdating(false);
      return;
    }
    if (next === "completed") {
      fetch("/api/jobs/notify-completed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      }).catch(() => {});
    }
    addToast(next === "completed" ? "Job marked complete" : "Status updated", "success");
    setUpdating(false);
    if (next === "completed" && !hasInvoice) {
      setShowInvoicePrompt(true);
    } else {
      router.refresh();
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
        <p className="text-xs uppercase tracking-wider text-mist font-600">Status actions</p>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt.next}
              onClick={() => updateStatus(opt.next)}
              disabled={updating}
              className={`px-3 py-2 rounded-lg text-sm font-700 disabled:opacity-50 transition-colors ${
                opt.next === "completed"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-amber text-forge hover:bg-amber-dark"
              }`}
            >
              {updating ? "Updating…" : opt.label}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {/* Invoice prompt modal */}
      {showInvoicePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4 mx-auto">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-display font-800 text-xl text-forge text-center mb-1">Job Complete!</h2>
            <p className="text-sm text-mist text-center mb-6">Would you like to create an invoice for this job now?</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowInvoicePrompt(false); router.refresh(); }}
                className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-600 hover:bg-gray-50 transition-colors text-forge"
              >
                Not now
              </button>
              <Link
                href={`/owner/invoices/new?jobId=${jobId}`}
                className="flex-1 bg-amber hover:bg-amber-dark text-forge font-display font-700 py-2.5 rounded-lg text-sm transition-colors text-center"
              >
                Create Invoice →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
