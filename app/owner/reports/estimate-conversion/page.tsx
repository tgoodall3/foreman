import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatCurrency, ESTIMATE_STATUS_CONFIG } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EstimateConversionPage() {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: estimates } = await supabase
    .from("estimates")
    .select("id, title, status, total, created_at, property_managers(full_name)")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })
    .limit(200);

  const stats = {
    total: estimates?.length ?? 0,
    sent: estimates?.filter((e: any) => e.status === "sent").length ?? 0,
    approved: estimates?.filter((e: any) => e.status === "approved").length ?? 0,
    converted: estimates?.filter((e: any) => e.status === "converted").length ?? 0,
    declined: estimates?.filter((e: any) => e.status === "declined").length ?? 0,
  };
  const winRate = stats.total ? Math.round(((stats.approved + stats.converted) / stats.total) * 100) : 0;

  return (
    <div className="p-6 max-w-5xl space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-mist font-700">Reports</p>
        <h1 className="font-display font-800 text-3xl text-forge leading-tight">Estimate Conversion</h1>
        <p className="text-mist text-sm mt-1">Track how many estimates turn into work.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Win rate" value={`${winRate}%`} />
        <StatCard label="Total estimates" value={stats.total} />
        <StatCard label="Approved" value={stats.approved} />
        <StatCard label="Converted" value={stats.converted} />
        <StatCard label="Declined" value={stats.declined} />
        <StatCard label="Sent" value={stats.sent} />
      </div>

      {!estimates?.length ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-mist text-sm">
          No estimates yet.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {/* Desktop table */}
          <table className="hidden sm:table w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">Title</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">PM</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {estimates.map((e: any) => {
                const cfg = ESTIMATE_STATUS_CONFIG[e.status] ?? ESTIMATE_STATUS_CONFIG.draft;
                return (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-600 text-forge">{e.title}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(e.total ?? 0)}</td>
                    <td className="px-4 py-3 text-sm text-steel">{e.property_managers?.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-steel">{e.created_at?.split("T")[0]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {estimates.map((e: any) => {
              const cfg = ESTIMATE_STATUS_CONFIG[e.status] ?? ESTIMATE_STATUS_CONFIG.draft;
              return (
                <div key={e.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-600 text-forge text-sm leading-snug">{e.title}</p>
                    <p className="text-xs text-mist mt-0.5">
                      {e.property_managers?.full_name ?? "—"} &middot; {e.created_at?.split("T")[0]}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`badge ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-sm font-600 text-forge">{formatCurrency(e.total ?? 0)}</span>
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-mist uppercase tracking-wide font-700">{label}</p>
      <p className="font-display font-800 text-xl text-forge mt-1">{value}</p>
    </div>
  );
}
