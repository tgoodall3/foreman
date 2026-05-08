import { requireOwner } from "@/lib/auth";
import { getOwnerInvoiceTotals, getOwnerInvoices } from "@/lib/services/owner";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate, formatCurrency, INVOICE_STATUS_CONFIG } from "@/lib/utils";
import Link from "next/link";
import ResendInvoiceButton from "@/components/owner/ResendInvoiceButton";
import SendInvoiceButton from "@/components/owner/SendInvoiceButton";
import { getServerT } from "@/lib/i18n/server";

const ARCHIVE_DAYS = 30;

function biweeklyLabel(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString("en-US", { month: "long", year: "numeric" });
  return d.getDate() <= 14 ? `${month} (1–14)` : `${month} (15–31)`;
}

function groupByBiweekly<T extends { created_at: string }>(items: T[]) {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const label = biweeklyLabel(item.created_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }
  return groups;
}

export default async function InvoicesPage({ searchParams }: { searchParams: { status?: string; page?: string; past?: string } }) {
  const profile  = await requireOwner();
  const t = await getServerT();
  const showPast = searchParams.past === "1";
  const page     = Math.max(1, Number(searchParams.page || "1"));
  const status   = searchParams.status;
  const totals   = await getOwnerInvoiceTotals(profile);

  const now = Date.now();
  const ageDays = (iso: string) => (now - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);

  let activeInvoices: any[] = [];
  let archivedInvoices: any[] = [];
  let pageCount = 1;

  if (showPast) {
    const supabase = await createServerSideClient();
    const cutoff = new Date(Date.now() - ARCHIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("invoices")
      .select("id, invoice_number, total, status, due_date, created_at, jobs(title), property_managers(full_name)")
      .eq("tenant_id", profile.tenant_id)
      .eq("status", "paid")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: false });
    archivedInvoices = data ?? [];
  } else {
    const { invoices, count, pageSize } = await getOwnerInvoices(profile, status, page);
    pageCount = Math.ceil(count / pageSize);
    activeInvoices   = invoices.filter((inv: any) => !(inv.status === "paid" && ageDays(inv.created_at) > ARCHIVE_DAYS));
    archivedInvoices = invoices.filter((inv: any) =>   inv.status === "paid" && ageDays(inv.created_at) > ARCHIVE_DAYS);
  }

  const archivedGroups = groupByBiweekly(archivedInvoices);

  return (
    <div className="page-shell page-shell-standard">
      <div className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">{t("invoices.title")}</h1>
        </div>
        <Link href="/owner/invoices/new" className="action-button-primary">
          {t("invoices.newInvoice")}
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="surface-card p-4">
          <p className="text-[11px] text-mist uppercase tracking-wider font-600">{t("invoices.totalPaid")}</p>
          <p className="font-display font-800 text-xl text-green-600 mt-1 truncate">{formatCurrency(totals.paid)}</p>
        </div>
        <div className="rounded-xl border border-amber/30 bg-amber/5 p-4">
          <p className="text-[11px] text-mist uppercase tracking-wider font-600">{t("invoices.outstanding")}</p>
          <p className="font-display font-800 text-xl text-amber-dark mt-1 truncate">{formatCurrency(totals.outstanding)}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-[11px] text-mist uppercase tracking-wider font-600">{t("invoices.drafts")}</p>
          <p className="font-display font-800 text-xl text-forge mt-1">{totals.draft}</p>
        </div>
      </div>

      {/* Active / Past toggle */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/owner/invoices" className={`px-4 py-1.5 rounded-full text-sm font-600 transition-colors ${!showPast ? "bg-forge text-white" : "text-mist hover:text-forge"}`}>
          {t("invoices.activeTab")}
        </Link>
        <Link href="/owner/invoices?past=1" className={`px-4 py-1.5 rounded-full text-sm font-600 transition-colors ${showPast ? "bg-forge text-white" : "text-mist hover:text-forge"}`}>
          {t("invoices.pastTab")} {archivedInvoices.length > 0 && <span className="ml-1 text-xs opacity-60">{archivedInvoices.length}</span>}
        </Link>
      </div>

      {/* Past view */}
      {showPast && (
        <div className="space-y-6">
          {Object.keys(archivedGroups).length === 0 ? (
            <div className="surface-empty">
              <p>{t("invoices.noPastInvoices")}</p>
            </div>
          ) : (
            Object.entries(archivedGroups).map(([label, items]) => (
              <div key={label}>
                <p className="text-xs font-700 uppercase tracking-widest text-mist mb-2 px-1">{label}</p>
                <div className="surface-card divide-y divide-gray-100">
                  {(items as any[]).map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="min-w-0">
                        <Link href={`/owner/invoices/${inv.id}`} className="font-600 text-forge hover:text-amber text-sm">{inv.invoice_number}</Link>
                        <p className="text-xs text-mist mt-0.5">{inv.jobs?.title ?? "—"} · {inv.property_managers?.full_name ?? "—"}</p>
                        <p className="text-xs text-mist">{t("invoices.paid", { date: formatDate(inv.created_at) })}</p>
                      </div>
                      <p className="font-700 text-forge text-sm shrink-0">{formatCurrency(inv.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {!showPast && <>

      {/* Status filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[undefined, "draft", "sent", "paid", "overdue"].map((s) => {
          const label = s ? INVOICE_STATUS_CONFIG[s as keyof typeof INVOICE_STATUS_CONFIG].label : t("common.all");
          const active = (s === undefined && !searchParams.status) || searchParams.status === s;
          return (
            <Link key={s || "all"} href={s ? `/owner/invoices?status=${s}` : "/owner/invoices"}
              className={`px-3 py-1.5 rounded-full text-xs font-600 border transition-colors ${active ? "bg-forge text-white border-forge" : "border-gray-300 text-mist hover:border-gray-400"}`}>
              {label}
            </Link>
          );
        })}
      </div>

      {/* Invoice list */}
      <div className="space-y-3">
        {!activeInvoices?.length ? (
          <div className="surface-empty">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="font-display font-700 text-xl text-forge mb-1">{t("invoices.noInvoices")}</p>
            <p className="text-mist text-sm">{t("invoices.noInvoicesNote")}</p>
          </div>
        ) : (
          activeInvoices.map((inv: any) => {
            const cfg = INVOICE_STATUS_CONFIG[inv.status as keyof typeof INVOICE_STATUS_CONFIG];
            const dueDate = new Date(inv.due_date + "T00:00:00Z");
            const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            let reminderBadge = "—";
            if (["sent","overdue"].includes(inv.status)) {
              if (daysOverdue >= 7) reminderBadge = "7-day sent";
              else if (daysOverdue >= 3) reminderBadge = "3-day sent";
              else if (daysOverdue >= 0) reminderBadge = "Next 3-day";
            }
            return (
              <Link
                key={inv.id}
                href={`/owner/invoices/${inv.id}`}
                className="surface-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 hover:border-amber/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-display font-700 text-forge text-sm">
                    {inv.invoice_number}
                  </p>
                  <p className="text-xs text-mist">{inv.jobs?.title || "—"}</p>
                  <p className="text-xs text-mist">{inv.property_managers?.full_name || "—"}</p>
                  <p className="text-xs text-steel">{t("invoices.due", { date: formatDate(inv.due_date) })}</p>
                  <p className="text-[11px] text-steel">{t("invoices.reminders", { count: reminderBadge })}</p>
                  <div className="mt-1 flex items-center gap-3">
                    {inv.status === "draft" ? (
                      <SendInvoiceButton invoiceId={inv.id} disabled={inv.status === "paid"} label={t("invoices.sendInvoice")} />
                    ) : (
                      <ResendInvoiceButton
                        invoiceId={inv.id}
                        disabled={inv.status === "paid"}
                      />
                    )}
                    <span className="inline-flex items-center justify-center gap-1 bg-white hover:bg-gray-50 text-forge border border-gray-300 text-xs sm:text-sm font-700 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg transition-colors min-h-[34px] sm:min-h-[40px] min-w-[82px] sm:min-w-[96px]">
                      {t("common.open")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:min-w-[140px]">
                  <p className="font-700 text-forge text-lg whitespace-nowrap">{formatCurrency(inv.total)}</p>
                  <span className={`px-2 py-1 rounded-full text-[11px] font-700 text-center whitespace-nowrap ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between px-1 py-3 text-sm">
          <Link href={`/owner/invoices?status=${status || ""}&page=${Math.max(1, page - 1)}`} className={`font-700 ${page === 1 ? "text-gray-400 pointer-events-none" : "text-forge hover:text-amber"}`}>← {t("common.previous")}</Link>
          <p className="text-xs text-mist">{t("common.pageOf", { page, pageCount })}</p>
          <Link href={`/owner/invoices?status=${status || ""}&page=${Math.min(pageCount, page + 1)}`} className={`font-700 ${page === pageCount ? "text-gray-400 pointer-events-none" : "text-forge hover:text-amber"}`}>{t("common.next")} →</Link>
        </div>
      )}
      </>}
    </div>
  );
}
