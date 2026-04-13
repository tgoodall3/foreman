import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import PortalEstimateClient from "./PortalEstimateClient";

export const dynamic = "force-dynamic";

export default async function PortalEstimatePage({ searchParams }: { searchParams: { token?: string; result?: string } }) {
  if (!searchParams.token) {
    notFound();
  }

  const supabase = createServiceClient();
  const { data: estimate } = await supabase
    .from("estimates")
    .select("id, title, estimate_number, status, total, subtotal, tax_rate, tax_amount, description, notes, valid_until, approval_token, line_items, property_managers(full_name, email, company, phone), properties(name, address, city, state), tenants(name)")
    .eq("approval_token", searchParams.token)
    .single();

  if (!estimate) notFound();

  const pm     = Array.isArray(estimate.property_managers) ? estimate.property_managers[0] : (estimate as any).property_managers;
  const prop   = Array.isArray(estimate.properties)        ? estimate.properties[0]        : (estimate as any).properties;
  const tenant = Array.isArray(estimate.tenants)           ? estimate.tenants[0]           : (estimate as any).tenants;

  const terminalResult = ["approved", "declined", "converted"].includes(estimate.status)
    ? estimate.status
    : undefined;

  return (
    <PortalEstimateClient
      estimate={estimate}
      pm={pm}
      prop={prop}
      tenant={tenant}
      token={searchParams.token}
      result={searchParams.result ?? terminalResult}
    />
  );
}
