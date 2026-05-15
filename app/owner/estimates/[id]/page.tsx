import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatCurrency, formatDate, ESTIMATE_STATUS_CONFIG } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import EstimateActions from "./EstimateActions";
import { getServerT } from "@/lib/i18n/server";

export default async function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile  = await requireOwner();
  const supabase = await createServerSideClient();
  const t = await getServerT();

  const { data: estimate } = await supabase
    .from("estimates")
    .select("*, property_managers(id, full_name, email), properties(name, address, city, state)")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!estimate) notFound();

  const statusCfg  = ESTIMATE_STATUS_CONFIG[estimate.status] ?? ESTIMATE_STATUS_CONFIG.draft;
  const lineItems  = estimate.line_items as any[];
  const pm         = estimate.property_managers as any;
  const prop       = estimate.properties as any;

  return (
    <div className="page-shell page-shell-tight">
      {/* Breadcrumb + header */}
      <div className="page-header gap-4 flex-wrap">
        <div className="page-header-copy">
          <div className="flex items-center gap-2 mb-1">
            <Link href="/owner/estimates" className="text-mist hover:text-forge text-sm transition-colors">{t("estimates.title")}</Link>
            <span className="text-mist">/</span>
            <span className="text-sm text-forge font-mono">{estimate.estimate_number}</span>
          </div>
          <h1 className="page-title">{estimate.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
            {estimate.valid_until && (
              <span className="text-xs text-mist">{t("estimates.validUntilLabel", { date: formatDate(estimate.valid_until) })}</span>
            )}
            <span className="text-xs text-mist">{t("estimates.createdLabel", { date: formatDate(estimate.created_at) })}</span>
          </div>
        </div>

        <EstimateActions
          estimateId={estimate.id}
          status={estimate.status}
          jobId={estimate.job_id}
          pmEmail={pm?.email || ""}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Scope */}
          {estimate.description && (
            <section className="surface-card p-5">
              <h2 className="font-display font-700 text-lg text-forge mb-3">{t("estimates.scopeOfWork")}</h2>
              <p className="text-sm text-steel leading-relaxed whitespace-pre-line">{estimate.description}</p>
            </section>
          )}

          {/* Line items */}
          <section className="surface-card p-5">
            <h2 className="font-display font-700 text-lg text-forge mb-4">{t("estimates.lineItemsSection")}</h2>
            <table className="w-full text-sm" aria-label="Estimate line items">
              <thead>
                <tr className="border-b border-gray-100">
                  <th scope="col" className="text-left pb-2 font-600 text-mist text-xs uppercase">{t("estimates.descriptionHeader")}</th>
                  <th scope="col" className="text-right pb-2 font-600 text-mist text-xs uppercase">{t("estimates.qty")}</th>
                  <th scope="col" className="text-right pb-2 font-600 text-mist text-xs uppercase">{t("estimates.unitPrice")}</th>
                  <th scope="col" className="text-right pb-2 font-600 text-mist text-xs uppercase">{t("estimates.totalColumn")}</th>
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
                {estimate.tax_rate > 0 && (
                  <>
                    <tr>
                      <td colSpan={3} className="pt-3 text-right text-mist text-sm">{t("estimates.subtotal")}</td>
                      <td className="pt-3 text-right text-mist">{formatCurrency(estimate.subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="py-1 text-right text-mist text-sm">{t("estimates.taxLine", { rate: String(estimate.tax_rate) })}</td>
                      <td className="py-1 text-right text-mist">{formatCurrency(estimate.tax_amount)}</td>
                    </tr>
                  </>
                )}
                <tr className="border-t border-gray-200">
                  <td colSpan={3} className="pt-3 text-right font-700 text-forge">{t("estimates.totalColumn")}</td>
                  <td className="pt-3 text-right font-display font-800 text-xl text-forge">{formatCurrency(estimate.total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* Notes */}
          {estimate.notes && (
            <section className="bg-amber/10 border border-amber/30 rounded-xl p-4">
              <p className="text-xs font-600 text-amber-dark uppercase tracking-wider mb-1">{t("estimates.notesLabel")}</p>
              <p className="text-sm text-steel leading-relaxed">{estimate.notes}</p>
            </section>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-mist uppercase tracking-wider font-600 mb-3">{t("estimates.summaryLabel")}</p>
            <p className="font-display font-800 text-3xl text-forge">{formatCurrency(estimate.total)}</p>
            <p className="text-xs text-mist mt-1">
              {lineItems.length !== 1
                ? t("estimates.lineItemsPlural", { count: String(lineItems.length) })
                : t("estimates.lineItemSingular", { count: String(lineItems.length) })}
              {estimate.tax_rate > 0 ? ` ${t("estimates.taxRateSuffix", { rate: String(estimate.tax_rate) })}` : ""}
            </p>
          </div>

          {/* Client */}
          {pm && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-mist uppercase tracking-wider font-600 mb-2">{t("estimates.clientLabel")}</p>
              <p className="font-600 text-forge text-sm">{pm.full_name}</p>
              <p className="text-xs text-mist mt-0.5">{pm.email}</p>
              <Link href={`/owner/properties?pm=${pm.id}`} className="text-xs text-amber hover:underline mt-1 inline-block">
                {t("estimates.viewProperties")}
              </Link>
            </div>
          )}

          {/* Property */}
          {prop && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-mist uppercase tracking-wider font-600 mb-2">{t("estimates.propertyLabel")}</p>
              <p className="font-600 text-forge text-sm">{prop.name}</p>
              <p className="text-xs text-mist mt-0.5">{prop.address}</p>
              <p className="text-xs text-mist">{prop.city}, {prop.state}</p>
            </div>
          )}

          {/* Linked job */}
          {estimate.job_id && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs font-600 text-green-700 uppercase tracking-wider mb-1">{t("estimates.convertedToJob")}</p>
              <Link href={`/owner/jobs/${estimate.job_id}`} className="text-sm text-green-700 hover:underline font-600">
                {t("estimates.viewJobLink")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
