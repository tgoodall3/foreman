import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import PortalChangeOrderClient from "./PortalChangeOrderClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PortalChangeOrderPage({ searchParams }: { searchParams: { token?: string; result?: string } }) {
  if (!searchParams.token) notFound();

  const supabase = createServiceClient();
  const { data: co } = await supabase
    .from("change_orders")
    .select("id, title, change_order_number, status, total, subtotal, tax_rate, tax_amount, description, notes, approval_token, line_items, property_managers(full_name, email), jobs(title), tenants(name)")
    .eq("approval_token", searchParams.token)
    .single();

  if (!co) notFound();

  const pm     = Array.isArray(co.property_managers) ? co.property_managers[0] : (co as any).property_managers;
  const job    = Array.isArray(co.jobs)              ? co.jobs[0]              : (co as any).jobs;
  const tenant = Array.isArray(co.tenants)           ? co.tenants[0]           : (co as any).tenants;

  const terminalResult = ["approved", "declined"].includes(co.status) ? co.status : undefined;

  return (
    <PortalChangeOrderClient
      changeOrder={co}
      pm={pm}
      job={job}
      tenant={tenant}
      token={searchParams.token}
      result={searchParams.result ?? terminalResult}
    />
  );
}
