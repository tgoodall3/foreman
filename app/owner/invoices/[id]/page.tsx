import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { getOwnerInvoice } from "@/lib/services/owner";
import { formatDate, formatCurrency, INVOICE_STATUS_CONFIG } from "@/lib/utils";
import InvoiceActions from "./InvoiceActions";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireOwner();
  const invoice = await getOwnerInvoice(profile, params.id);

  if (!invoice) {
    notFound();
  }

  const statusCfg = INVOICE_STATUS_CONFIG[invoice.status as keyof typeof INVOICE_STATUS_CONFIG];
  const managerName = invoice.property_managers?.full_name || "Unknown";
  const jobTitle = invoice.jobs?.title || "Unknown job";

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/owner/invoices" className="text-mist hover:text-forge text-sm transition-colors">Invoices</Link>
        <span className="text-mist">/</span>
        <span className="text-sm text-forge">{invoice.invoice_number}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-mist font-600">Invoice</p>
            <h1 className="font-display font-800 text-3xl text-forge mt-2">{invoice.invoice_number}</h1>
            <p className="text-sm text-mist mt-1">Created {formatDate(invoice.created_at)}</p>
          </div>
          <div className="flex items-center gap-3">
            <InvoiceActions invoiceId={invoice.id} status={invoice.status} />
            <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
          </div>
        </div>

        <div className="grid gap-4 mt-6 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-mist font-600">Due date</p>
            <p className="font-600 text-forge mt-1">{formatDate(invoice.due_date)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-mist font-600">Property manager</p>
            <p className="font-600 text-forge mt-1">{managerName}</p>
            {invoice.property_managers?.company && <p className="text-xs text-mist">{invoice.property_managers.company}</p>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-mist font-600">Job</p>
            <Link href={`/owner/jobs/${invoice.job_id}`} className="font-600 text-amber hover:underline mt-1 block">{jobTitle}</Link>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-display font-700 text-lg text-forge mb-4">Line items</h2>
        <div className="overflow-hidden rounded-xl border border-gray-100">
          <table className="min-w-full text-sm" aria-label="Invoice line items">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-mist">
              <tr>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Unit</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {(invoice.line_items || []).map((item: any, idx: number) => (
                <tr key={idx}>
                  <td className="px-4 py-3 text-forge">{item.description}</td>
                  <td className="px-4 py-3 text-right text-mist">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-mist">{formatCurrency(item.unit_price)}</td>
                  <td className="px-4 py-3 text-right font-600 text-forge">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-wider text-mist font-600">Subtotal</p>
          <p className="font-800 text-forge text-2xl mt-2">{formatCurrency(invoice.subtotal)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-wider text-mist font-600">Tax ({invoice.tax_rate || 0}%)</p>
          <p className="font-800 text-forge text-2xl mt-2">{formatCurrency(invoice.tax_amount)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-wider text-mist font-600">Total</p>
          <p className="font-800 text-forge text-2xl mt-2">{formatCurrency(invoice.total)}</p>
        </div>
      </div>

      {invoice.notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
          <h2 className="font-display font-700 text-lg text-forge mb-3">Notes</h2>
          <p className="text-sm text-steel leading-relaxed">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}
