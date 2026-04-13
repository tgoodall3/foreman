import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatCurrency, formatDate, ESTIMATE_STATUS_CONFIG } from "@/lib/utils";
import Link from "next/link";

function daysUntilExpiry(validUntil: string | null): number | null {
  if (!validUntil) return null;
  const diff = new Date(validUntil + "T00:00:00Z").getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

const ARCHIVE_STATUSES = ["approved", "declined", "converted"];
const ARCHIVE_DAYS = 7;

function isArchived(est: { status: string; updated_at: string }) {
  if (!ARCHIVE_STATUSES.includes(est.status)) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ARCHIVE_DAYS);
  return new Date(est.updated_at) < cutoff;
}

export default async function EstimatesPage({
  searchParams,
}: {
  searchParams: { status?: string; past?: string };
}) {
  const profile  = await requireOwner();
  const supabase = await createServerSideClient();
  const showPast = searchParams.past === "1";

  let query = supabase
    .from("estimates")
    .select("id, estimate_number, title, status, total, created_at, updated_at, valid_until, property_managers(full_name), properties(name)")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  if (searchParams.status) query = query.eq("status", searchParams.status);

  const { data: allEstimates } = await query;

  // Split active vs archived
  const active   = (allEstimates ?? []).filter((e) => !isArchived(e));
  const archived = (allEstimates ?? []).filter((e) => isArchived(e));
  const estimates = showPast ? archived : active;

  const statuses = Object.keys(ESTIMATE_STATUS_CONFIG);

  // Count by status (active only for badges)
  const counts: Record<string, number> = {};
  for (const e of active) counts[e.status] = (counts[e.status] ?? 0) + 1;

  return (
    <div className="page-shell page-shell-wide">
      <div className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">Estimates</h1>
          <p className="page-subtitle">
            {active.length} active
            {archived.length > 0 ? ` · ${archived.length} past` : ""}
          </p>
        </div>
        <Link
          href="/owner/estimates/new"
          className="action-button-primary"
        >
          + New Estimate
        </Link>
      </div>

      {/* Active / Past toggle */}
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/owner/estimates"
          className={`px-4 py-1.5 rounded-full text-sm font-600 transition-colors ${
            !showPast ? "bg-forge text-white" : "text-mist hover:text-forge"
          }`}
        >
          Active
          {active.length > 0 && (
            <span className={`ml-1.5 text-xs ${!showPast ? "opacity-70" : "opacity-50"}`}>
              {active.length}
            </span>
          )}
        </Link>
        <Link
          href="/owner/estimates?past=1"
          className={`px-4 py-1.5 rounded-full text-sm font-600 transition-colors ${
            showPast ? "bg-forge text-white" : "text-mist hover:text-forge"
          }`}
        >
          Past
          {archived.length > 0 && (
            <span className={`ml-1.5 text-xs ${showPast ? "opacity-70" : "opacity-50"}`}>
              {archived.length}
            </span>
          )}
        </Link>
      </div>

      {/* Status filter (only on active tab) */}
      {!showPast && (
        <div className="flex gap-2 flex-wrap mb-6" role="group" aria-label="Filter estimates by status">
          <Link
            href="/owner/estimates"
            className={`px-3 py-1.5 rounded-full text-xs font-600 border transition-colors ${
              !searchParams.status
                ? "bg-forge text-white border-forge"
                : "border-gray-300 text-mist hover:border-forge"
            }`}
          >
            All
          </Link>
          {statuses.map((s) => {
            const cfg = ESTIMATE_STATUS_CONFIG[s];
            return (
              <Link
                key={s}
                href={`/owner/estimates?status=${s}`}
                className={`px-3 py-1.5 rounded-full text-xs font-600 border transition-colors ${
                  searchParams.status === s
                    ? `${cfg.bg} ${cfg.color} border-current`
                    : "border-gray-300 text-mist hover:border-gray-400"
                }`}
              >
                {cfg.label}
                {counts[s] ? <span className="ml-1 opacity-70">({counts[s]})</span> : null}
              </Link>
            );
          })}
        </div>
      )}

      {/* Table / Cards */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!estimates.length ? (
          <div className="p-12 text-center">
            <p className="text-mist text-sm mb-3">
              {showPast ? "No past estimates." : "No estimates found"}
            </p>
            {!showPast && (
              <Link href="/owner/estimates/new" className="text-amber hover:underline text-sm">
                Create an estimate →
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm" role="grid" aria-label="Estimates list">
                  <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Number</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Title</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Client</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Created</th>
                  <th scope="col" className="text-right px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Total</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {estimates.map((est: any) => {
                  const cfg = ESTIMATE_STATUS_CONFIG[est.status] ?? ESTIMATE_STATUS_CONFIG.draft;
                  const expDays = ["draft","sent"].includes(est.status) ? daysUntilExpiry(est.valid_until) : null;
                  return (
                    <tr key={est.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-600 text-mist font-mono text-xs">{est.estimate_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/owner/estimates/${est.id}`}
                          className="block w-full font-600 text-forge hover:text-amber transition-colors"
                        >
                          {est.title}
                        </Link>
                        {est.properties?.name && (
                          <p className="text-xs text-mist mt-0.5">{est.properties.name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-mist text-sm">
                        {(est.property_managers as any)?.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-mist text-sm">
                        {formatDate(est.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right font-600 text-forge">
                        {formatCurrency(est.total)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`badge ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                          {expDays !== null && expDays <= 7 && (
                            <span className={`text-[10px] font-700 px-1.5 py-0.5 rounded ${expDays <= 0 ? "bg-red-100 text-red-700" : "bg-amber/20 text-amber-dark"}`}>
                              {expDays <= 0 ? "Expired" : `Expires in ${expDays}d`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/owner/estimates/${est.id}`}
                          className="inline-flex items-center gap-1 bg-forge hover:bg-forge-light text-white text-xs font-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {estimates.map((est: any) => {
                const cfg = ESTIMATE_STATUS_CONFIG[est.status] ?? ESTIMATE_STATUS_CONFIG.draft;
                const expDays = ["draft","sent"].includes(est.status) ? daysUntilExpiry(est.valid_until) : null;
                return (
                  <div key={est.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-600 text-forge text-sm leading-snug">{est.title}</p>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`badge ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        {expDays !== null && expDays <= 7 && (
                          <span className={`text-[10px] font-700 px-1.5 py-0.5 rounded ${expDays <= 0 ? "bg-red-100 text-red-700" : "bg-amber/20 text-amber-dark"}`}>
                            {expDays <= 0 ? "Expired" : `Exp. ${expDays}d`}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-mist">
                      {(est.property_managers as any)?.full_name || "—"}
                      {est.properties?.name ? ` · ${est.properties.name}` : ""}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="font-600 text-forge text-sm">{formatCurrency(est.total)}</span>
                      <Link
                        href={`/owner/estimates/${est.id}`}
                        className="inline-flex items-center bg-forge hover:bg-forge-light text-white text-xs font-700 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
