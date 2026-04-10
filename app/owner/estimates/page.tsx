import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatCurrency, formatDate, ESTIMATE_STATUS_CONFIG } from "@/lib/utils";
import Link from "next/link";

export default async function EstimatesPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const profile  = await requireOwner();
  const supabase = await createServerSideClient();

  let query = supabase
    .from("estimates")
    .select("id, estimate_number, title, status, total, created_at, valid_until, property_managers(full_name), properties(name)")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  if (searchParams.status) query = query.eq("status", searchParams.status);

  const { data: estimates } = await query;

  const statuses = Object.keys(ESTIMATE_STATUS_CONFIG);

  // Count by status
  const { data: allForCount } = await supabase
    .from("estimates")
    .select("status")
    .eq("tenant_id", profile.tenant_id);

  const counts: Record<string, number> = {};
  for (const e of allForCount ?? []) counts[e.status] = (counts[e.status] ?? 0) + 1;

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-800 text-3xl text-forge">Estimates</h1>
          <p className="text-mist text-sm mt-1">
            {countsAll(allForCount)} total
            {searchParams.status ? ` · ${estimates?.length ?? 0} shown` : ""}
          </p>
        </div>
        <Link
          href="/owner/estimates/new"
          className="bg-amber hover:bg-amber-dark text-forge font-display font-700 px-4 py-2.5 rounded-lg text-sm transition-colors min-h-[44px] flex items-center"
        >
          + New Estimate
        </Link>
      </div>

      {/* Status filter */}
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

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!estimates?.length ? (
          <div className="p-12 text-center">
            <p className="text-mist text-sm mb-3">No estimates found</p>
            <Link href="/owner/estimates/new" className="text-amber hover:underline text-sm">
              Create an estimate →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm" role="grid" aria-label="Estimates list">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Number</th>
                <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Title</th>
                <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider hidden sm:table-cell">Client</th>
                <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider hidden md:table-cell">Created</th>
                <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider hidden md:table-cell">Valid Until</th>
                <th scope="col" className="text-right px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Total</th>
                <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {estimates.map((est: any) => {
                const cfg = ESTIMATE_STATUS_CONFIG[est.status] ?? ESTIMATE_STATUS_CONFIG.draft;
                return (
                  <tr key={est.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/owner/estimates/${est.id}`} className="font-600 text-forge hover:text-amber transition-colors font-mono text-xs">
                        {est.estimate_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/owner/estimates/${est.id}`} className="font-500 text-forge hover:text-amber transition-colors">
                        {est.title}
                      </Link>
                      {est.properties?.name && (
                        <p className="text-xs text-mist mt-0.5">{est.properties.name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-mist hidden sm:table-cell">
                      {(est.property_managers as any)?.full_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-mist hidden md:table-cell">
                      {formatDate(est.created_at)}
                    </td>
                    <td className="px-4 py-3 text-mist hidden md:table-cell">
                      {est.valid_until ? formatDate(est.valid_until) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-600 text-forge">
                      {formatCurrency(est.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function countsAll(rows: any[] | null | undefined) {
  return rows?.length ?? 0;
}
