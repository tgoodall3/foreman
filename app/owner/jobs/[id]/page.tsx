import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate, formatDateTime, JOB_STATUS_CONFIG, PRIORITY_CONFIG, formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("*, properties(name, address, city, state), work_orders(title, description)")
    .eq("id", params.id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!job) notFound();

  const [{ data: photos }, { data: notes }, { data: workers }] = await Promise.all([
    supabase.from("job_photos").select("*, profiles(full_name)").eq("job_id", job.id).order("created_at"),
    supabase.from("job_notes").select("*, profiles(full_name)").eq("job_id", job.id).order("created_at"),
    supabase.from("profiles").select("id, full_name").eq("tenant_id", profile.tenant_id).eq("role", "worker").eq("is_active", true),
  ]);

  const assignedWorkers = workers?.filter((w) => job.assigned_workers?.includes(w.id)) || [];
  const statusCfg = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
  const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];
  const lineItems = job.line_items || [];
  const total = lineItems.reduce((s: number, i: any) => s + i.total, 0);

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/owner/jobs" className="text-mist hover:text-forge text-sm transition-colors">Jobs</Link>
            <span className="text-mist">/</span>
            <span className="text-sm text-forge">{job.title}</span>
          </div>
          <h1 className="font-display font-800 text-3xl text-forge">{job.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
            <span className={`badge ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
            {job.scheduled_date && (
              <span className="text-xs text-mist">Scheduled: {formatDate(job.scheduled_date)}</span>
            )}
          </div>
        </div>
        <Link
          href={`/owner/jobs/${job.id}/edit`}
          className="bg-forge hover:bg-forge-light text-white font-display font-700 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Edit Job
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: main details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {job.description && (
            <section aria-labelledby="desc-heading" className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 id="desc-heading" className="font-display font-700 text-lg text-forge mb-3">Description</h2>
              <p className="text-sm text-steel leading-relaxed">{job.description}</p>
            </section>
          )}

          {/* Photos */}
          <section aria-labelledby="photos-heading" className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 id="photos-heading" className="font-display font-700 text-lg text-forge mb-4">
              Photos ({photos?.length || 0})
            </h2>
            {!photos?.length ? (
              <p className="text-sm text-mist">No photos yet</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((photo: any) => (
                  <div key={photo.id} className="group relative">
                    <a href={photo.url} target="_blank" rel="noopener noreferrer" aria-label={`View photo: ${photo.caption || photo.type}`}>
                      <img
                        src={photo.url}
                        alt={photo.caption || `${photo.type} photo`}
                        className="w-full h-28 object-cover rounded-lg border border-gray-200 group-hover:opacity-90 transition-opacity"
                      />
                    </a>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-mist capitalize">{photo.type}</span>
                      <span className="text-xs text-mist">{photo.profiles?.full_name}</span>
                    </div>
                    {photo.caption && <p className="text-xs text-steel mt-0.5">{photo.caption}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Notes */}
          <section aria-labelledby="notes-heading" className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 id="notes-heading" className="font-display font-700 text-lg text-forge mb-4">
              Notes ({notes?.length || 0})
            </h2>
            {!notes?.length ? (
              <p className="text-sm text-mist">No notes yet</p>
            ) : (
              <div className="space-y-3">
                {notes.map((note: any) => (
                  <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-600 text-forge">{note.profiles?.full_name || "Unknown"}</span>
                      <span className="text-xs text-mist">{formatDateTime(note.created_at)}</span>
                    </div>
                    <p className="text-sm text-steel">{note.text}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Line Items */}
          {lineItems.length > 0 && (
            <section aria-labelledby="billing-heading" className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 id="billing-heading" className="font-display font-700 text-lg text-forge mb-4">Billing</h2>
              <table className="w-full text-sm" aria-label="Job line items">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th scope="col" className="text-left pb-2 font-600 text-mist text-xs uppercase">Description</th>
                    <th scope="col" className="text-right pb-2 font-600 text-mist text-xs uppercase">Qty</th>
                    <th scope="col" className="text-right pb-2 font-600 text-mist text-xs uppercase">Unit Price</th>
                    <th scope="col" className="text-right pb-2 font-600 text-mist text-xs uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lineItems.map((item: any) => (
                    <tr key={item.id}>
                      <td className="py-2 text-forge">{item.description}</td>
                      <td className="py-2 text-right text-mist">{item.quantity}</td>
                      <td className="py-2 text-right text-mist">{formatCurrency(item.unit_price)}</td>
                      <td className="py-2 text-right font-600">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td colSpan={3} className="pt-3 text-right font-700 text-forge">Total</td>
                    <td className="pt-3 text-right font-800 text-forge">{formatCurrency(total)}</td>
                  </tr>
                </tfoot>
              </table>
              {job.status === "completed" && !job.invoice_id && (
                <div className="mt-4">
                  <Link
                    href={`/owner/invoices/new?job=${job.id}`}
                    className="inline-flex bg-amber hover:bg-amber-dark text-forge font-display font-700 px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    Generate Invoice
                  </Link>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right: sidebar */}
        <div className="space-y-4">
          {/* Property */}
          {job.properties && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-mist uppercase tracking-wider font-600 mb-2">Property</p>
              <p className="font-600 text-forge text-sm">{job.properties.name}</p>
              <p className="text-xs text-mist mt-1">{job.properties.address}</p>
              <p className="text-xs text-mist">{job.properties.city}, {job.properties.state}</p>
            </div>
          )}

          {/* Assigned Workers */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-mist uppercase tracking-wider font-600 mb-2">Assigned Workers</p>
            {assignedWorkers.length === 0 ? (
              <p className="text-xs text-mist">No workers assigned</p>
            ) : (
              <ul className="space-y-2">
                {assignedWorkers.map((w) => (
                  <li key={w.id} className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-steel rounded-full flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-700">{w.full_name[0]}</span>
                    </div>
                    <span className="text-sm font-500 text-forge">{w.full_name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* From Work Order */}
          {job.work_orders && (
            <div className="bg-amber/10 border border-amber/30 rounded-xl p-4">
              <p className="text-xs font-600 text-amber-dark uppercase tracking-wider mb-2">From Work Order</p>
              <p className="font-600 text-sm text-forge">{job.work_orders.title}</p>
              <p className="text-xs text-steel mt-1 line-clamp-3">{job.work_orders.description}</p>
              <Link href={`/owner/work-orders/${job.work_order_id}`} className="text-xs text-amber hover:underline mt-2 inline-block">
                View work order →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
