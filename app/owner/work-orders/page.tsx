import { requireOwner } from "@/lib/auth";
import { getOwnerWorkOrders } from "@/lib/services/owner";
import { formatDate, PRIORITY_CONFIG } from "@/lib/utils";
import Link from "next/link";
import { getServerT } from "@/lib/i18n/server";

export default async function WorkOrdersPage() {
  const profile = await requireOwner();
  const t = await getServerT();
  const workOrders = await getOwnerWorkOrders(profile);

  const now = Date.now();
  const ageDays = (iso: string) => (now - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
  const isPast = (w: any) => ["accepted", "declined"].includes(w.status) && ageDays(w.created_at) > 14;

  const active    = workOrders?.filter((w) => !isPast(w)) || [];
  const archived  = workOrders?.filter((w) => isPast(w)) || [];

  const pending   = active.filter((w) => w.status === "pending");
  const accepted  = active.filter((w) => w.status === "accepted");
  const declined  = active.filter((w) => w.status === "declined");

  return (
    <div className="page-shell page-shell-standard">
      <div className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">{t("workOrders.title")}</h1>
          <p className="page-subtitle">{t("workOrders.pendingReview", { count: pending.length })}</p>
        </div>
      </div>

      {/* Pending - most important */}
      {pending.length > 0 && (
        <section aria-labelledby="pending-heading" className="mb-8">
          <h2 id="pending-heading" className="font-display font-700 text-xl text-forge mb-3 flex items-center gap-2">
            {t("workOrders.pendingTab")}
            <span className="w-6 h-6 bg-amber text-forge text-xs font-700 rounded-full flex items-center justify-center">
              {pending.length}
            </span>
          </h2>
          <div className="space-y-3">
            {pending.map((wo: any) => <WorkOrderCard key={wo.id} wo={wo} t={t} />)}
          </div>
        </section>
      )}

      {/* Accepted */}
      {accepted.length > 0 && (
        <section aria-labelledby="accepted-heading" className="mb-8">
          <h2 id="accepted-heading" className="font-display font-700 text-xl text-forge mb-3">{t("workOrders.acceptedTab")}</h2>
          <div className="space-y-3">
            {accepted.map((wo: any) => <WorkOrderCard key={wo.id} wo={wo} t={t} />)}
          </div>
        </section>
      )}

      {/* Declined */}
      {declined.length > 0 && (
        <section aria-labelledby="declined-heading" className="mb-8">
          <h2 id="declined-heading" className="font-display font-700 text-xl text-forge mb-3 text-mist">{t("workOrders.declinedTab")}</h2>
          <div className="space-y-3">
            {declined.map((wo: any) => <WorkOrderCard key={wo.id} wo={wo} t={t} />)}
          </div>
        </section>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <section aria-labelledby="archived-heading" className="mb-6">
          <h2 id="archived-heading" className="font-display font-700 text-xl text-mist mb-3">{t("workOrders.pastTab")}</h2>
          <div className="space-y-3">
            {archived.map((wo: any) => <WorkOrderCard key={wo.id} wo={wo} muted t={t} />)}
          </div>
        </section>
      )}

      {!workOrders?.length && (
        <div className="surface-empty py-16">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
          <p className="font-display font-700 text-xl text-forge mb-1">{t("workOrders.noWorkOrders")}</p>
          <p className="text-mist text-sm">{t("workOrders.workOrdersNote")}</p>
        </div>
      )}
    </div>
  );
}

type TFn = (key: string, vars?: Record<string, string | number>) => string;
function WorkOrderCard({ wo, muted = false, t }: { wo: any; muted?: boolean; t: TFn }) {
  const priorityCfg = PRIORITY_CONFIG[wo.priority as keyof typeof PRIORITY_CONFIG];
  const statusColors: Record<string, string> = {
    pending:  "bg-yellow-100 text-yellow-700",
    accepted: "bg-green-100 text-green-700",
    declined: "bg-gray-100 text-gray-500",
  };
  const job = Array.isArray(wo.jobs) ? wo.jobs[0] : (wo as any).jobs?.[0];

  return (
    <Link
      href={`/owner/work-orders/${wo.id}`}
      className={`surface-card block p-4 transition-all hover:shadow-md ${
        muted ? "border-gray-200 text-mist" : "border-gray-200 hover:border-amber/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-700 text-forge sm:text-base">{wo.title}</h3>
            <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
            <span className={`badge ${statusColors[wo.status]}`}>{wo.status}</span>
          </div>
          <p className="text-xs xs:text-sm text-mist">
            {wo.property_managers?.full_name}
            {wo.property_managers?.company && ` · ${wo.property_managers.company}`}
            {" · "}{wo.properties?.name}
          </p>
          <p className="text-[11px] xs:text-xs text-mist mt-1">{formatDate(wo.created_at)}</p>
          {job && (
            <div className="mt-3">
              <Link
                href={`/owner/jobs/${job.id}`}
                className="action-button-secondary min-h-[36px] px-3 py-1.5 text-xs xs:text-sm"
              >
                {t("workOrders.viewJob")} →
              </Link>
            </div>
          )}
        </div>
        <span className="text-mist text-sm shrink-0">→</span>
      </div>
    </Link>
  );
}
// Force dynamic rendering to avoid static 404s when data/env missing at build time
// Force dynamic rendering (and use service client in detail pages) to avoid stale static pages and RLS edge cases
export const dynamic = "force-dynamic";
