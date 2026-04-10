import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PortalEstimatePage({ searchParams }: { searchParams: { token?: string } }) {
  if (!searchParams.token) {
    notFound();
  }

  const supabase = createServiceClient();
  const { data: estimate } = await supabase
    .from("estimates")
    .select("id, title, estimate_number, status, total, description, valid_until, approval_token, property_managers(full_name, email), properties(name, address, city, state)")
    .eq("approval_token", searchParams.token)
    .single();

  if (!estimate) notFound();

  const pm = Array.isArray(estimate.property_managers) ? estimate.property_managers[0] : (estimate as any).property_managers;
  const prop = Array.isArray(estimate.properties) ? estimate.properties[0] : (estimate as any).properties;

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-mist font-700">Estimate</p>
            <h1 className="font-display font-800 text-2xl text-forge">{estimate.title}</h1>
            <p className="text-sm text-mist">#{estimate.estimate_number}</p>
          </div>
          <span className="text-lg font-display font-800 text-forge">{formatCurrency(estimate.total)}</span>
        </div>

        {prop && (
          <div className="border border-gray-100 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-mist font-600 mb-1">Property</p>
            <p className="text-sm font-600 text-forge">{prop.name}</p>
            <p className="text-xs text-mist">{prop.address}</p>
            <p className="text-xs text-mist">{prop.city}, {prop.state}</p>
          </div>
        )}

        {estimate.description && (
          <p className="text-sm text-steel">{estimate.description}</p>
        )}

        <div className="flex items-center justify-between text-xs text-mist">
          <span>Valid until {estimate.valid_until ? formatDate(estimate.valid_until) : "—"}</span>
          {pm?.full_name && <span>Contact: {pm.full_name}</span>}
        </div>

        <form action="/api/portal/estimate/status" method="POST" className="flex gap-3">
          <input type="hidden" name="token" value={searchParams.token} />
          <button
            name="status"
            value="approved"
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-display font-700 py-2.5 rounded-lg text-sm transition-colors"
          >
            Approve
          </button>
          <button
            name="status"
            value="declined"
            className="flex-1 border border-gray-300 text-forge font-display font-700 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Decline
          </button>
        </form>
      </div>
    </div>
  );
}
