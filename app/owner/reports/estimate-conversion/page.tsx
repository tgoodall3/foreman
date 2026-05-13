import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatCurrency, ESTIMATE_STATUS_CONFIG } from "@/lib/utils";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function EstimateConversionPage() {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();
  const t = await getServerT();

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
    <div className="page-shell page-shell-standard">
      <div className="page-header-copy">
        <p className="page-eyebrow">{t("reports.eyebrow")}</p>
        <h1 className="page-title">{t("reports.estimateConversionTitle")}</h1>
        <p className="page-subtitle">{t("reports.estimateConversionSub")}</p>
      </div>
      <ReportTabs active="estimate-conversion" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("reports.winRate")} value={`${winRate}%`} />
        <StatCard label={t("reports.totalEstimates")} value={stats.total} />
        <StatCard label={t("reports.approved")} value={stats.approved} />
        <StatCard label={t("reports.converted")} value={stats.converted} />
        <StatCard label={t("reports.declinedLabel")} value={stats.declined} />
        <StatCard label={t("reports.sentLabel")} value={stats.sent} />
      </div>

      {!estimates?.length ? (
        <div className="surface-empty">
          {t("reports.noEstimatesYet")}
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          {/* Desktop table */}
          <table className="hidden sm:table w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">{t("reports.titleHeader")}</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">{t("reports.statusHeader")}</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">{t("reports.amountHeader")}</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">{t("reports.pmHeader")}</th>
                <th className="px-4 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">{t("reports.createdHeader")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {estimates.map((e: any) => {
                const cfg = ESTIMATE_STATUS_CONFIG[e.status] ?? ESTIMATE_STATUS_CONFIG.draft;
                return (
                  <tr key={e.id} className="relative hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <a
                        href={`/owner/estimates/${e.id}`}
                        className="font-600 text-forge line-clamp-1 after:absolute after:inset-0 after:content-['']"
                      >
                        {e.title}
                      </a>
                    </td>
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
                <a key={e.id} href={`/owner/estimates/${e.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="font-600 text-forge text-sm leading-snug line-clamp-1">{e.title}</p>
                    <p className="text-xs text-mist mt-0.5">
                      {e.property_managers?.full_name ?? "—"} &middot; {e.created_at?.split("T")[0]}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`badge ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-sm font-600 text-forge">{formatCurrency(e.total ?? 0)}</span>
                  </div>
                </a>
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

function ReportTabs({ active }: { active: "revenue" | "jobs-to-invoice" | "estimate-conversion" }) {
  const tabs = [
    { key: "revenue" as const, label: "Revenue", href: "/owner/reports/revenue" },
    { key: "jobs-to-invoice" as const, label: "Billing Gap", href: "/owner/reports/jobs-to-invoice" },
    { key: "estimate-conversion" as const, label: "Conversions", href: "/owner/reports/estimate-conversion" },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {tabs.map((tab) => (
        <a
          key={tab.key}
          href={tab.href}
          className={`px-4 py-1.5 rounded-full text-sm font-600 transition-colors ${
            active === tab.key ? "bg-forge text-white" : "text-mist hover:text-forge border border-gray-200 hover:border-forge"
          }`}
        >
          {tab.label}
        </a>
      ))}
    </div>
  );
}
