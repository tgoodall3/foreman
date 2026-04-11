import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import PortalInvoiceClient from "./PortalInvoiceClient";

export const dynamic = "force-dynamic";

export default async function PortalInvoicePage({
  searchParams,
}: {
  searchParams: { token?: string; invoice?: string; paid?: string };
}) {
  if (!searchParams.token || !searchParams.invoice) notFound();

  const supabase = createServiceClient();

  // Verify the portal token → PM
  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, tenant_id, full_name, email, company")
    .eq("portal_token", searchParams.token)
    .single();

  if (!pm) notFound();

  // Load invoice and verify it belongs to this PM
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, total, subtotal, tax_rate, tax_amount, due_date, created_at, notes, line_items, jobs(title), tenants(name, email)"
    )
    .eq("id", searchParams.invoice)
    .eq("property_manager_id", pm.id)
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
      token={searchParams.token}
      paidSuccess={searchParams.paid === "true"}
    />
  );
}
