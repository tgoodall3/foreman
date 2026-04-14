import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { requirePortalPm } from "@/lib/portal";
import PortalInvoiceClient from "./PortalInvoiceClient";

export const dynamic = "force-dynamic";

export default async function PortalInvoicePage({
  searchParams,
}: {
  searchParams: { invoice?: string; paid?: string };
}) {
  if (!searchParams.invoice) notFound();

  const pm = await requirePortalPm("id, tenant_id, full_name, email, company, is_active");

  const supabase = createServiceClient();

  // Resolve all PM IDs for this email (handles re-invites)
  let propertyManagerIds = [pm.id];
  if (pm.email) {
    const { data: aliases } = await supabase
      .from("property_managers")
      .select("id")
      .eq("tenant_id", pm.tenant_id)
      .eq("email", pm.email);
    if (aliases && aliases.length > 0) {
      propertyManagerIds = Array.from(new Set(aliases.map((a: { id: string }) => a.id)));
    }
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, total, subtotal, tax_rate, tax_amount, due_date, created_at, notes, line_items, jobs(title), tenants(name, email)"
    )
    .eq("id", searchParams.invoice)
    .in("property_manager_id", propertyManagerIds)
    .eq("tenant_id", pm.tenant_id)
    .single();

  if (!invoice) notFound();

  const tenant = Array.isArray(invoice.tenants) ? invoice.tenants[0] : (invoice as any).tenants;
  const job    = Array.isArray(invoice.jobs)    ? invoice.jobs[0]    : (invoice as any).jobs;

  return (
    <PortalInvoiceClient
      invoice={invoice}
      pm={pm}
      tenant={tenant}
      job={job}
      paidSuccess={searchParams.paid === "true"}
    />
  );
}
