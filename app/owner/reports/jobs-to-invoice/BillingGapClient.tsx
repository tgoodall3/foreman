"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, PRIORITY_CONFIG } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastContainer";

interface Job {
  id: string;
  title: string;
  priority: string;
  updated_at: string;
  properties: { id: string; name: string; property_manager_id: string | null } | null;
  work_orders: { title: string }[] | null;
}

export default function BillingGapClient({ jobs: initialJobs }: { jobs: Job[] }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [jobs, setJobs] = useState(initialJobs);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulking, setBulking] = useState(false);

  const allSelected = jobs.length > 0 && selected.size === jobs.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(jobs.map((j) => j.id)));
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Only jobs with a PM can be auto-invoiced
  const selectableIds = jobs.filter((j) => j.properties?.property_manager_id).map((j) => j.id);
  const selectedCount = Array.from(selected).filter((id) => selectableIds.includes(id)).length;

  const bulkInvoice = async () => {
    const ids = Array.from(selected).filter((id) => selectableIds.includes(id));
    if (!ids.length) return;
    setBulking(true);
    try {
      const res = await fetch("/api/invoices/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || "Bulk invoice failed", "error"); return; }
      addToast(`${data.created} draft invoice${data.created !== 1 ? "s" : ""} created`, "success");
      setJobs((prev) => prev.filter((j) => !ids.includes(j.id)));
      setSelected(new Set());
      if (data.skipped > 0) addToast(`${data.skipped} job${data.skipped !== 1 ? "s" : ""} skipped (no property manager)`, "error");
    } catch {
      addToast("Something went wrong", "error");
    } finally {
      setBulking(false);
    }
  };

  return (
    <div className="page-shell page-shell-standard">
      <div className="page-header">
        <div className="page-header-copy">
          <p className="page-eyebrow">Reports</p>
          <h1 className="page-title">Billing Gap</h1>
          <p className="page-subtitle">
            {jobs.length} completed job{jobs.length !== 1 ? "s" : ""} without an invoice.
          </p>
        </div>
        <div className="page-actions self-start flex-wrap">
          {selected.size > 0 && (
            <button
              onClick={bulkInvoice}
              disabled={bulking || selectedCount === 0}
              className="action-button-dark whitespace-nowrap disabled:opacity-50"
            >
              {bulking ? "Creating…" : `Invoice ${selectedCount} selected`}
            </button>
          )}
          <Link
            href="/owner/invoices/new"
            className="action-button-primary whitespace-nowrap"
          >
            New Invoice
          </Link>
        </div>
      </div>

      {!jobs.length ? (
        <div className="surface-empty">
          All completed jobs are invoiced.
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          {/* Desktop table */}
          <table className="hidden sm:table w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-amber"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">Job</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">Property</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">Completed</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">Priority</th>
                <th className="px-4 py-3 text-right text-xs font-700 text-mist uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((job) => {
                const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal;
                const completed = job.updated_at ? formatDate(job.updated_at.split("T")[0]) : "—";
                const hasPM = !!job.properties?.property_manager_id;
                return (
                  <tr key={job.id} className={`hover:bg-gray-50 transition-colors ${selected.has(job.id) ? "bg-amber/5" : ""}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(job.id)}
                        onChange={() => toggle(job.id)}
                        className="w-4 h-4 accent-amber"
                        aria-label={`Select ${job.title}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/owner/jobs/${job.id}`} className="text-forge font-600 hover:text-amber">
                        {job.title}
                      </Link>
                      {(job.work_orders as any)?.[0]?.title && (
                        <p className="text-xs text-mist mt-0.5 line-clamp-1">WO: {(job.work_orders as any)[0].title}</p>
                      )}
                      {!hasPM && (
                        <p className="text-xs text-amber-600 mt-0.5">No property manager &mdash; can&apos;t auto-invoice</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-steel">{job.properties?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-steel">{completed}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link href={`/owner/invoices/new?jobId=${job.id}`} className="text-xs font-700 text-amber hover:underline">
                        Invoice
                      </Link>
                      <Link href={`/owner/jobs/${job.id}`} className="text-xs font-700 text-forge hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {jobs.map((job) => {
              const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal;
              const completed = job.updated_at ? formatDate(job.updated_at.split("T")[0]) : "—";
              const hasPM = !!job.properties?.property_manager_id;
              return (
                <div key={job.id} className={`px-4 py-3 space-y-2 ${selected.has(job.id) ? "bg-amber/5" : ""}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(job.id)}
                      onChange={() => toggle(job.id)}
                      className="w-4 h-4 accent-amber mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/owner/jobs/${job.id}`} className="text-forge font-600 hover:text-amber text-sm leading-snug">
                          {job.title}
                        </Link>
                        <span className={`badge shrink-0 ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                      </div>
                      <p className="text-xs text-mist mt-0.5">{job.properties?.name ?? "—"} · {completed}</p>
                      {!hasPM && <p className="text-xs text-amber-600 mt-0.5">No PM &mdash; can&apos;t auto-invoice</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    <Link
                      href={`/owner/invoices/new?jobId=${job.id}`}
                      className="inline-flex items-center bg-amber text-forge text-xs font-700 px-3 py-1.5 rounded-lg hover:bg-amber-dark transition-colors"
                    >
                      Invoice
                    </Link>
                    <Link
                      href={`/owner/jobs/${job.id}`}
                      className="inline-flex items-center bg-white border border-gray-300 text-forge text-xs font-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
