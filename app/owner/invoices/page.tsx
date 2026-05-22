import { requireOwner } from "@/lib/auth";
import { getOwnerInvoiceTotals, getOwnerInvoices } from "@/lib/services/owner";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate, formatCurrency, INVOICE_STATUS_CONFIG } from "@/lib/utils";
import Link from "next/link";
import ResendInvoiceButton from "@/components/owner/ResendInvoiceButton";
import SendInvoiceButton from "@/components/owner/SendInvoiceButton";
import { getServerT } from "@/lib/i18n/server";
import EmptyState from "@/components/ui/EmptyState";
import { CheckCircle, AlertCircle, FileText, ChevronLeft, ChevronRight, Receipt } from "lucide-react";

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

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; past?: string }>;
}) {
  const { status, past, page: pageParam } = await searchParams;
  const profile   = await requireOwner();
  const t         = await getServerT();
  const showPast  = past === "1";
  const page      = Math.max(1, Number(pageParam || "1"));
  const totals    = await getOwnerInvoiceTotals(profile);

  const now = Date.now();
  const ageDays = (iso: string) => (now - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);

  let activeInvoices:   any[] = [];
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
    pageCount        = Math.ceil(count / pageSize);
    activeInvoices   = invoices.filter((inv: any) => !(inv.status === "paid" && ageDays(inv.created_at) > ARCHIVE_DAYS));
    archivedInvoices = invoices.filter((inv: any) =>   inv.status === "paid" && ageDays(inv.created_at) > ARCHIVE_DAYS);
  }

  const archivedGroups = groupByBiweekly(archivedInvoices);

  return (
    <div className="page-shell page-shell-standard">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">{t("invoices.title")}</h1>
        </div>
        <Link href="/owner/invoices/new" className="action-button-primary">
          {t("invoices.newInvoice")}
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          label={t("invoices.totalPaid")}
          value={formatCurrency(totals.paid)}
          icon={<CheckCircle className="h-4 w-4" />}
          color="emerald"
        />
        <SummaryCard
          label={t("invoices.outstanding")}
          value={formatCurrency(totals.outstanding)}
          icon={<AlertCircle className="h-4 w-4" />}
          color="amber"
          highlight={totals.outstanding > 0}
        />
        <SummaryCard
          label={t("invoices.drafts")}
          value={String(totals.draft)}
          icon={<FileText className="h-4 w-4" />}
          color="neutral"
        />
      </div>

      {/* Active / Past toggle */}
      <div className="flex items-center gap-1.5">
        <Link
          href="/owner/invoices"
          className={`px-4 py-1.5 rounded-full text-sm font-600 transition-all ${
            !showPast
              ? "bg-forge text-white shadow-sm"
              : "text-mist hover:text-forge hover:bg-gray-100"
          }`}
        >
          {t("invoices.activeTab")}
        </Link>
        <Link
          href="/owner/invoices?past=1"
          className={`px-4 py-1.5 rounded-full text-sm font-600 transition-all ${
            showPast
              ? "bg-forge text-white shadow-sm"
              : "text-mist hover:text-forge hover:bg-gray-100"
          }`}
        >
          {t("invoices.pastTab")}
          {archivedInvoices.length > 0 && (
            <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gray-200 text-gray-600 text-[10px] font-700 px-1">
              {archivedInvoices.length}
            </span>
          )}
        </Link>
      </div>

      {/* Past view */}
      {showPast && (
        <div className="space-y-6">
          {Object.keys(archivedGroups).length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title={t("invoices.noPastInvoices")}
              description="Paid invoices older than 30 days will appear here."
            />
          ) : (
            Object.entries(archivedGroups).map(([label, items]) => (
              <div key={label}>
                <p className="section-label mb-2 px-1">{label}</p>
                <div className="surface-card divide-y divide-gray-100">
                  {(items as any[]).map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between px-5 py-3.5 gap-3 hover:bg-gray-50 transition-colors">
                      <div className="min-w-0">
                        <Link
                          href={`/owner/invoices/${inv.id}`}
                          className="text-sm font-600 text-forge hover:text-amber transition-colors"
                        >
                          {inv.invoice_number}
                        </Link>
                        <p className="text-xs text-mist mt-0.5">
                          {inv.jobs?.title ?? "—"} · {inv.property_managers?.full_name ?? "—"}
                        </p>
                        <p className="text-xs text-mist">
                          {t("invoices.paid", { date: formatDate(inv.created_at) })}
                        </p>
                      </div>
                      <p className="font-700 text-forge text-sm shrink-0 tabular-nums">
                        {formatCurrency(inv.total)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {!showPast && (
        <>
          {/* Status filters */}
          <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter invoices by status">
            {([undefined, "draft", "sent", "paid", "overdue"] as const).map((s) => {
              const label  = s ? INVOICE_STATUS_CONFIG[s as keyof typeof INVOICE_STATUS_CONFIG].label : t("common.all");
              const active = (s === undefined && !status) || status === s;
              return (
                <Link
                  key={s || "all"}
                  href={s ? `/owner/invoices?status=${s}` : "/owner/invoices"}
                  className={[
                    "px-3 py-1.5 rounded-full text-xs font-600 border transition-all",
                    active
                      ? "bg-forge text-white border-forge shadow-sm"
                      : "border-gray-300 text-mist hover:border-gray-400 hover:text-forge",
                  ].join(" ")}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Invoice list */}
          <div className="space-y-2.5">
            {!activeInvoices?.length ? (
              <EmptyState
                icon={<Receipt className="h-6 w-6" />}
                title={t("invoices.noInvoices")}
                description={t("invoices.noInvoicesNote")}
                action={{ label: t("invoices.newInvoice"), href: "/owner/invoices/new" }}
              />
            ) : (
              activeInvoices.map((inv: any) => {
                const cfg = INVOICE_STATUS_CONFIG[inv.status as keyof typeof INVOICE_STATUS_CONFIG];
                return (
                  <div
                    key={inv.id}
                    className="surface-card overflow-hidden hover:border-amber/40 transition-all hover:shadow-card-md"
                  >
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                      {/* Left: info */}
                      <Link href={`/owner/invoices/${inv.id}`} className="min-w-0 flex-1 group">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-700 text-forge group-hover:text-amber transition-colors">
                            {inv.invoice_number}
                          </p>
                          <span className={`badge ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <p className="text-xs text-mist">
                          {inv.jobs?.title || "—"} · {inv.property_managers?.full_name || "—"}
                        </p>
                        <p className="text-xs text-steel mt-0.5">
                          {t("invoices.due", { date: formatDate(inv.due_date) })}
                        </p>
                      </Link>

                      {/* Right: amount + actions */}
                      <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
                        <p className="font-display font-800 text-xl text-forge tabular-nums">
                          {formatCurrency(inv.total)}
                        </p>
                        <div className="flex items-center gap-2">
                          {inv.status === "draft" ? (
                            <SendInvoiceButton invoiceId={inv.id} disabled={inv.status === "paid"} label={t("invoices.sendInvoice")} />
                          ) : (
                            <ResendInvoiceButton invoiceId={inv.id} disabled={inv.status === "paid"} />
                          )}
                          <Link
                            href={`/owner/invoices/${inv.id}`}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white text-forge text-xs font-700 px-3 py-1.5 min-h-[34px] hover:bg-gray-50 transition-colors"
                          >
                            {t("common.open")}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between px-1 py-2">
              <Link
                href={`/owner/invoices?${new URLSearchParams({ ...(status ? { status } : {}), page: String(Math.max(1, page - 1)) })}`}
                className={`inline-flex items-center gap-1.5 text-sm font-600 transition-colors ${page === 1 ? "text-gray-300 pointer-events-none" : "text-forge hover:text-amber"}`}
                aria-disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" /> {t("common.previous")}
              </Link>
              <p className="text-xs text-mist">{t("common.pageOf", { page, pageCount })}</p>
              <Link
                href={`/owner/invoices?${new URLSearchParams({ ...(status ? { status } : {}), page: String(Math.min(pageCount, page + 1)) })}`}
                className={`inline-flex items-center gap-1.5 text-sm font-600 transition-colors ${page === pageCount ? "text-gray-300 pointer-events-none" : "text-forge hover:text-amber"}`}
                aria-disabled={page === pageCount}
              >
                {t("common.next")} <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label, value, icon, color, highlight = false,
}: {
  label: string; value: string; icon: React.ReactNode;
  color: "emerald" | "amber" | "neutral"; highlight?: boolean;
}) {
  const styles = {
    emerald: { icon: "bg-emerald-100 text-emerald-600", value: "text-emerald-700" },
    amber:   { icon: "bg-amber/15 text-amber-dark",      value: "text-amber-dark"  },
    neutral: { icon: "bg-gray-100 text-gray-500",         value: "text-forge"       },
  };
  const s = styles[color];

  return (
    <div className={`surface-card p-4 ${highlight ? "border-amber/40 bg-amber/3" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label mb-2">{label}</p>
          <p className={`font-display font-800 text-2xl leading-none tabular-nums ${s.value}`}>
            {value}
          </p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.icon}`}>
          {icon}
        </span>
      </div>
    </div>
  );
}
