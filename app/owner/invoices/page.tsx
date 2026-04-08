import { requireOwner } from "@/lib/auth";
import { getOwnerInvoiceTotals, getOwnerInvoices } from "@/lib/services/owner";
import { formatDate, formatCurrency, INVOICE_STATUS_CONFIG } from "@/lib/utils";
import Link from "next/link";

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

      {/* Invoice table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {!invoices?.length ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">💵</p>
            <p className="font-display font-700 text-xl text-forge mb-1">No invoices yet</p>
            <p className="text-mist text-sm">Complete a job and generate an invoice.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm" aria-label="Invoices list">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Invoice #</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Job</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Client</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Due</th>
                  <th scope="col" className="text-right px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Total</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv: any) => {
                  const cfg = INVOICE_STATUS_CONFIG[inv.status as keyof typeof INVOICE_STATUS_CONFIG];
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/owner/invoices/${inv.id}`} className="font-mono text-sm text-amber hover:underline">{inv.invoice_number}</Link>
                      </td>
                      <td className="px-4 py-3 text-forge font-500">{inv.jobs?.title || "—"}</td>
                      <td className="px-4 py-3 text-mist">{inv.property_managers?.full_name || "—"}</td>
                      <td className="px-4 py-3 text-mist">{formatDate(inv.due_date)}</td>
                      <td className="px-4 py-3 text-right font-600 text-forge">{formatCurrency(inv.total)}</td>
                      <td className="px-4 py-3"><span className={`badge ${cfg.bg} ${cfg.color}`}>{cfg.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pageCount > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <Link
                  href={`/owner/invoices?status=${status || ""}&page=${Math.max(1, page - 1)}`}
                  className={`text-sm font-semibold ${page === 1 ? "text-gray-400 pointer-events-none" : "text-forge hover:text-amber"}`}
                >
                  ← Previous
                </Link>
                <p className="text-xs text-mist">
                  Page {page} of {pageCount}
                </p>
                <Link
                  href={`/owner/invoices?status=${status || ""}&page=${Math.min(pageCount, page + 1)}`}
                  className={`text-sm font-semibold ${page === pageCount ? "text-gray-400 pointer-events-none" : "text-forge hover:text-amber"}`}
                >
                  Next →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
