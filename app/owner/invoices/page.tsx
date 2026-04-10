import { requireOwner } from "@/lib/auth";
import { getOwnerInvoiceTotals, getOwnerInvoices } from "@/lib/services/owner";
import { formatDate, formatCurrency, INVOICE_STATUS_CONFIG } from "@/lib/utils";
import Link from "next/link";
import ResendInvoiceButton from "@/components/owner/ResendInvoiceButton";
import SendInvoiceButton from "@/components/owner/SendInvoiceButton";

export default async function InvoicesPage({ searchParams }: { searchParams: { status?: string; page?: string } }) {
  const profile = await requireOwner();
  const page = Math.max(1, Number(searchParams.page || "1"));
  const status = searchParams.status;
  const { invoices, count, pageSize } = await getOwnerInvoices(profile, status, page);
  const totals = await getOwnerInvoiceTotals(profile);

  const pageCount = Math.ceil(count / pageSize);

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-800 text-3xl text-forge">Invoices</h1>
        <Link href="/owner/invoices/new" className="bg-amber hover:bg-amber-dark text-forge font-display font-700 px-4 py-2.5 rounded-lg text-sm transition-colors min-h-[44px] flex items-center">
          + New Invoice
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-mist uppercase tracking-wider font-600">Total Paid</p>
          <p className="font-display font-800 text-2xl text-green-600 mt-1">{formatCurrency(totals.paid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber/30 bg-amber/5 p-4">
          <p className="text-xs text-mist uppercase tracking-wider font-600">Outstanding</p>
          <p className="font-display font-800 text-2xl text-amber-dark mt-1">{formatCurrency(totals.outstanding)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-mist uppercase tracking-wider font-600">Drafts</p>
          <p className="font-display font-800 text-2xl text-forge mt-1">{totals.draft}</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[undefined, "draft", "sent", "paid", "overdue"].map((s) => {
          const label = s ? INVOICE_STATUS_CONFIG[s as keyof typeof INVOICE_STATUS_CONFIG].label : "All";
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
        {!invoices?.length ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-4xl mb-3">💵</p>
            <p className="font-display font-700 text-xl text-forge mb-1">No invoices yet</p>
            <p className="text-mist text-sm">Complete a job and generate an invoice.</p>
          </div>
        ) : (
          invoices.map((inv: any) => {
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
              <div key={inv.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/owner/invoices/${inv.id}`} className="font-display font-700 text-forge hover:text-amber text-sm">
                    {inv.invoice_number}
                  </Link>
                  <p className="text-xs text-mist">{inv.jobs?.title || "—"}</p>
                  <p className="text-xs text-mist">{inv.property_managers?.full_name || "—"}</p>
                  <p className="text-xs text-steel">Due {formatDate(inv.due_date)}</p>
                  <p className="text-[11px] text-steel">Reminders: {reminderBadge}</p>
                  <div className="mt-1 flex items-center gap-3">
                    {inv.status === "draft" ? (
                      <SendInvoiceButton invoiceId={inv.id} disabled={inv.status === "paid"} label="Send invoice" />
                    ) : (
                      <ResendInvoiceButton
                        invoiceId={inv.id}
                        disabled={inv.status === "paid"}
                      />
                    )}
                    <Link href={`/owner/invoices/${inv.id}`} className="text-xs text-mist hover:text-amber font-700">
                      Edit
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                  <p className="font-700 text-forge text-lg">{formatCurrency(inv.total)}</p>
                  <span className={`badge ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between px-1 py-3 text-sm">
          <Link
            href={`/owner/invoices?status=${status || ""}&page=${Math.max(1, page - 1)}`}
            className={`font-700 ${page === 1 ? "text-gray-400 pointer-events-none" : "text-forge hover:text-amber"}`}
          >
            ← Previous
          </Link>
          <p className="text-xs text-mist">Page {page} of {pageCount}</p>
          <Link
            href={`/owner/invoices?status=${status || ""}&page=${Math.min(pageCount, page + 1)}`}
            className={`font-700 ${page === pageCount ? "text-gray-400 pointer-events-none" : "text-forge hover:text-amber"}`}
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}
