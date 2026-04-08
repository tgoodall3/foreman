import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, badRequest } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { generateInvoiceNumber } from "@/lib/utils";
import { logError } from "@/lib/logger";

/**
 * POST /api/jobs/[id]/auto-invoice
 * Creates a draft invoice for a completed job that has line items + a property manager.
 * Idempotent — does nothing if an invoice already exists.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile  = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, status, invoice_id, line_items, property_id, tenant_id")
    .eq("id", params.id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!job)                   return badRequest("Job not found.");
  if (job.invoice_id)         return jsonResponse({ skipped: true, reason: "already_invoiced" });
  if (job.status !== "completed") return jsonResponse({ skipped: true, reason: "not_completed" });

  const lineItems: any[] = job.line_items ?? [];
  if (!lineItems.length)      return jsonResponse({ skipped: true, reason: "no_line_items" });

  // Find the property manager for this property
  const { data: property } = await supabase
    .from("properties")
    .select("property_manager_id")
    .eq("id", job.property_id)
    .single();

  if (!property?.property_manager_id)
    return jsonResponse({ skipped: true, reason: "no_property_manager" });

  // Tenant slug for invoice number
  const { data: tenant } = await supabase
    .from("tenants")
    .select("slug")
    .eq("id", profile.tenant_id)
    .single();

  if (!tenant) return errorResponse("Tenant not found.", 500);

  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id);

  // Recalculate totals from line items
  const sanitized = lineItems.map((item: any) => {
    const qty   = Number(item.quantity);
    const price = Number(item.unit_price);
    const total = Math.round((qty * price + Number.EPSILON) * 100) / 100;
    return { description: item.description, quantity: qty, unit_price: price, total };
  });
  const subtotal = sanitized.reduce((s, i) => s + i.total, 0);

  // Default due date: 30 days from today
  const due = new Date();
  due.setDate(due.getDate() + 30);
  const dueDate = due.toISOString().split("T")[0];

  const invoiceNumber = generateInvoiceNumber(tenant.slug, (count ?? 0) + 1);

  const { data: invoice, error: insertErr } = await supabase
    .from("invoices")
    .insert({
      tenant_id:           profile.tenant_id,
      job_id:              job.id,
      property_manager_id: property.property_manager_id,
      invoice_number:      invoiceNumber,
      status:              "draft",
      line_items:          sanitized,
      subtotal,
      tax_rate:            0,
      tax_amount:          0,
      total:               subtotal,
      due_date:            dueDate,
    })
    .select("id")
    .single();

  if (insertErr || !invoice) {
    logError("Auto-invoice insert failed", insertErr);
    return errorResponse("Failed to create invoice.", 500);
  }

  await supabase
    .from("jobs")
    .update({ invoice_id: invoice.id, status: "invoiced" })
    .eq("id", job.id);

  return jsonResponse({ success: true, invoiceId: invoice.id }, 201);
}
