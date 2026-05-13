import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

function monthKey(iso: string) {
  return iso.slice(0, 7); // "2025-04"
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default async function RevenueReportPage() {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();
  const t = await getServerT();

  // Last 6 months
  const since = new Date();
  since.setMonth(since.getMonth() - 5);
  since.setDate(1);
  const sinceStr = since.toISOString().split("T")[0];

  const [{ data: invoices }, { data: pmList }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, total, status, due_date, paid_at, created_at, property_manager_id, property_managers(full_name)")
      .eq("tenant_id", profile.tenant_id)
      .gte("created_at", sinceStr + "T00:00:00Z")
      .order("created_at", { ascending: false }),
    supabase
      .from("property_managers")
      .select("id, full_name")
      .eq("tenant_id", profile.tenant_id)
      .order("full_name"),
  ]);

  const all = invoices ?? [];

  // Monthly revenue buckets (paid invoices)
  const monthlyMap: Record<string, number> = {};
  for (const inv of all) {
    if (inv.status === "paid" && inv.paid_at) {
      const k = monthKey(inv.paid_at);
      monthlyMap[k] = (monthlyMap[k] ?? 0) + (inv.total ?? 0);
    }
  }

  // Build last 6 months in order
  const months: { key: string; label: string; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    d.setDate(1);
    const k = d.toISOString().slice(0, 7);
    months.push({ key: k, label: monthLabel(k), revenue: monthlyMap[k] ?? 0 });
  }

  const maxRevenue = Math.max(...months.map((m) => m.revenue), 1);

  // Revenue by PM
  const pmRevMap: Record<string, { name: string; paid: number; outstanding: number }> = {};
  for (const inv of all) {
    const pmId = inv.property_manager_id ?? "unknown";
    const pmName = (inv.property_managers as any)?.full_name ?? "Unknown";
    if (!pmRevMap[pmId]) pmRevMap[pmId] = { name: pmName, paid: 0, outstanding: 0 };
    if (inv.status === "paid") pmRevMap[pmId].paid += inv.total ?? 0;
    else if (["sent", "overdue"].includes(inv.status)) pmRevMap[pmId].outstanding += inv.total ?? 0;
  }
  const pmRevRows = Object.values(pmRevMap).sort((a, b) => (b.paid + b.outstanding) - (a.paid + a.outstanding));

  // Aging buckets (outstanding invoices)
  const now = Date.now();
  const aging = { current: 0, d30: 0, d60: 0, d90: 0 };
  for (const inv of all) {
    if (!["sent", "overdue"].includes(inv.status)) continue;
    const daysOverdue = Math.floor((now - new Date(inv.due_date + "T00:00:00Z").getTime()) / 86400000);
    if (daysOverdue <= 0) aging.current += inv.total ?? 0;
    else if (daysOverdue <= 30) aging.d30 += inv.total ?? 0;
    else if (daysOverdue <= 60) aging.d60 += inv.total ?? 0;
    else aging.d90 += inv.total ?? 0;
  }

  const totalPaid = all.filter((i) => i.status === "paid").reduce((s, i) => s + (i.total ?? 0), 0);
  const totalOutstanding = all.filter((i) => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + (i.total ?? 0), 0);
  const totalDraft = all.filter((i) => i.status === "draft").reduce((s, i) => s + (i.total ?? 0), 0);

  return (
    <div className="page-shell page-shell-standard space-y-6">
      <div className="page-header-copy">
        <p className="page-eyebrow">{t("reports.eyebrow")}</p>
        <h1 className="page-title">{t("reports.revenueTitle")}</h1>
        <p className="text-mist text-sm mt-1">{t("reports.revenueSub", { count: String(all.length) })}</p>
      </div>
      <ReportTabs active="revenue" />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="surface-card p-4">
          <p className="text-xs text-mist uppercase tracking-wide font-700">{t("reports.collected")}</p>
          <p className="font-display font-800 text-2xl text-green-600 mt-1">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber/30 bg-amber/5 p-4">
          <p className="text-xs text-mist uppercase tracking-wide font-700">{t("reports.outstanding")}</p>
          <p className="font-display font-800 text-2xl text-amber-dark mt-1">{formatCurrency(totalOutstanding)}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs text-mist uppercase tracking-wide font-700">{t("reports.inDraft")}</p>
          <p className="font-display font-800 text-2xl text-forge mt-1">{formatCurrency(totalDraft)}</p>
        </div>
      </div>

      {/* Monthly bar chart */}
      <div className="surface-card p-5">
        <h2 className="font-display font-700 text-base text-forge mb-4">{t("reports.monthlyRevenue")}</h2>
        <div className="flex items-end gap-2 h-40">
          {months.map((m) => {
            const heightPct = maxRevenue > 0 ? (m.revenue / maxRevenue) * 100 : 0;
            const isCurrentMonth = m.key === new Date().toISOString().slice(0, 7);
            return (
              <div key={m.key} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <p className="text-xs text-mist font-600 tabular-nums truncate w-full text-center">
                  {m.revenue > 0 ? formatCurrency(m.revenue).replace("$", "$") : ""}
                </p>
                <div className="w-full flex items-end" style={{ height: "80px" }}>
                  <div
                    className={`w-full rounded-t-md transition-all ${isCurrentMonth ? "bg-amber" : "bg-forge/20"}`}
                    style={{ height: `${Math.max(heightPct, m.revenue > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <p className="text-[10px] text-mist truncate w-full text-center">{m.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice aging */}
      <div className="surface-card p-5">
        <h2 className="font-display font-700 text-base text-forge mb-4">{t("reports.invoiceAging")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("reports.agingCurrent"), value: aging.current, color: "text-green-600" },
            { label: t("reports.aging1to30"), value: aging.d30, color: "text-amber-dark" },
            { label: t("reports.aging31to60"), value: aging.d60, color: "text-orange-600" },
            { label: t("reports.aging60plus"), value: aging.d90, color: "text-red-600" },
          ].map((b) => (
            <div key={b.label} className="border border-gray-100 rounded-xl p-3">
              <p className="text-xs text-mist font-700 uppercase tracking-wide">{b.label}</p>
              <p className={`font-display font-800 text-xl mt-1 ${b.color}`}>{formatCurrency(b.value)}</p>
            </div>
          ))}
        </div>
        {totalOutstanding > 0 && (
          <div className="mt-3">
            <Link href="/owner/invoices?status=overdue" className="text-xs text-amber hover:underline font-600">
              {t("reports.viewOverdue")}
            </Link>
          </div>
        )}
      </div>

      {/* Revenue by client */}
      {pmRevRows.length > 0 && (
        <div className="surface-card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-display font-700 text-base text-forge">{t("reports.revenueByClient")}</h2>
          </div>
          {/* Desktop */}
          <table className="hidden sm:table w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-700 text-mist uppercase tracking-wide">{t("reports.clientHeader")}</th>
                <th className="px-5 py-3 text-right text-xs font-700 text-mist uppercase tracking-wide">{t("reports.collectedHeader")}</th>
                <th className="px-5 py-3 text-right text-xs font-700 text-mist uppercase tracking-wide">{t("reports.outstandingHeader")}</th>
                <th className="px-5 py-3 text-right text-xs font-700 text-mist uppercase tracking-wide">{t("reports.totalHeader")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pmRevRows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-600 text-forge">{row.name}</td>
                  <td className="px-5 py-3 text-right text-green-600 font-600">{formatCurrency(row.paid)}</td>
                  <td className="px-5 py-3 text-right text-amber-dark font-600">{row.outstanding > 0 ? formatCurrency(row.outstanding) : "—"}</td>
                  <td className="px-5 py-3 text-right font-700 text-forge">{formatCurrency(row.paid + row.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Mobile */}
          <div className="sm:hidden divide-y divide-gray-100">
            {pmRevRows.map((row, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                <p className="font-600 text-forge text-sm">{row.name}</p>
                <div className="text-right shrink-0">
                  <p className="text-sm font-700 text-forge">{formatCurrency(row.paid + row.outstanding)}</p>
                  <p className="text-xs text-green-600">{formatCurrency(row.paid)} {t("reports.collectedLabel")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
