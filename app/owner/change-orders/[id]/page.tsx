import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatCurrency, formatDate, CHANGE_ORDER_STATUS_CONFIG } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import ChangeOrderActions from "./ChangeOrderActions";

export default async function ChangeOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile  = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: co } = await supabase
    .from("change_orders")
    .select("*, property_managers(id, full_name, email), jobs(id, title)")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!co) notFound();

  const statusCfg = CHANGE_ORDER_STATUS_CONFIG[co.status] ?? CHANGE_ORDER_STATUS_CONFIG.draft;
  const lineItems = co.line_items as any[];
  const pm        = (co as any).property_managers as any;
  const job       = (co as any).jobs as any;

  return (
    <div className="page-shell page-shell-tight">
      <div className="page-header gap-4 flex-wrap">
        <div className="page-header-copy">
          <div className="flex items-center gap-2 mb-1">
            {job && (
              <>
                <Link href="/owner/jobs" className="text-mist hover:text-forge text-sm transition-colors">Jobs</Link>
                <span className="text-mist">/</span>
                <Link href={`/owner/jobs/${job.id}`} className="text-mist hover:text-forge text-sm transition-colors">{job.title}</Link>
                <span className="text-mist">/</span>
              </>
            )}
            <span className="text-sm text-forge font-mono">{co.change_order_number}</span>
          </div>
          <h1 className="page-title">{co.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
            <span className="text-xs text-mist">Created {formatDate(co.created_at)}</span>
          </div>
        </div>

        <ChangeOrderActions
          changeOrderId={co.id}
          jobId={job?.id ?? ""}
          status={co.status}
          pmEmail={pm?.email ?? ""}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {co.description && (
            <section className="surface-card p-5">
              <h2 className="font-display font-700 text-lg text-forge mb-3">Scope of Change</h2>
              <p className="text-sm text-steel leading-relaxed whitespace-pre-line">{co.description}</p>
            </section>
          )}

          <section className="surface-card p-5">
            <h2 className="font-display font-700 text-lg text-forge mb-4">Line Items</h2>
            <table className="w-full text-sm" aria-label="Change order line items">
              <thead>
                <tr className="border-b border-gray-100">
                  <th scope="col" className="text-left pb-2 font-600 text-mist text-xs uppercase">Description</th>
                  <th scope="col" className="text-right pb-2 font-600 text-mist text-xs uppercase">Qty</th>
                  <th scope="col" className="text-right pb-2 font-600 text-mist text-xs uppercase">Unit Price</th>
                  <th scope="col" className="text-right pb-2 font-600 text-mist text-xs uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lineItems.map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="py-2.5 text-forge">{item.description}</td>
                    <td className="py-2.5 text-right text-mist">{item.quantity}</td>
                    <td className="py-2.5 text-right text-mist">{formatCurrency(item.unit_price)}</td>
                    <td className="py-2.5 text-right font-600">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {co.tax_rate > 0 && (
                  <>
                    <tr>
                      <td colSpan={3} className="pt-3 text-right text-mist text-sm">Subtotal</td>
                      <td className="pt-3 text-right text-mist">{formatCurrency(co.subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="py-1 text-right text-mist text-sm">Tax ({co.tax_rate}%)</td>
                      <td className="py-1 text-right text-mist">{formatCurrency(co.tax_amount)}</td>
                    </tr>
                  </>
                )}
                <tr className="border-t border-gray-200">
                  <td colSpan={3} className="pt-3 text-right font-700 text-forge">Total</td>
                  <td className="pt-3 text-right font-display font-800 text-xl text-forge">{formatCurrency(co.total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          {co.notes && (
            <section className="bg-amber/10 border border-amber/30 rounded-xl p-4">
              <p className="text-xs font-600 text-amber-dark uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-steel leading-relaxed">{co.notes}</p>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-mist uppercase tracking-wider font-600 mb-3">Summary</p>
            <p className="font-display font-800 text-3xl text-forge">{formatCurrency(co.total)}</p>
            <p className="text-xs text-mist mt-1">
              {lineItems.length} line item{lineItems.length !== 1 ? "s" : ""}
              {co.tax_rate > 0 ? ` · ${co.tax_rate}% tax` : ""}
            </p>
          </div>

          {pm && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-mist uppercase tracking-wider font-600 mb-2">Property Manager</p>
              <p className="font-600 text-forge text-sm">{pm.full_name}</p>
              <p className="text-xs text-mist mt-0.5">{pm.email}</p>
            </div>
          )}

          {job && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-mist uppercase tracking-wider font-600 mb-2">Job</p>
              <Link href={`/owner/jobs/${job.id}`} className="text-sm font-600 text-forge hover:underline">{job.title}</Link>
            </div>
          )}

          {co.status === "approved" && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs font-600 text-green-700 uppercase tracking-wider mb-1">Approved</p>
              <p className="text-xs text-green-600">The property manager has approved this change order.</p>
            </div>
          )}
          {co.status === "declined" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs font-600 text-red-700 uppercase tracking-wider mb-1">Declined</p>
              <p className="text-xs text-red-600">The property manager declined this change order.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
