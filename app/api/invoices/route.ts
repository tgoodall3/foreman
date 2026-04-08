import { NextRequest } from "next/server";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { createServerSideClient } from "@/lib/supabase-server";
import { getProfile } from "@/lib/auth";
import { createInvoiceSchema, validateInput } from "@/lib/validation";
import { generateInvoiceNumber } from "@/lib/utils";
import { logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const profile = await getProfile();
  if (!profile) return badRequest("Unauthorized");

  const body = await req.json();
  const validation = validateInput(createInvoiceSchema, body);
  if (!validation.success) {
    return badRequest((validation as { error: string }).error);
  }

  const { jobId, propertyManagerId, status, dueDate, notes, lineItems, taxRate } = validation.data;
  const supabase = await createServerSideClient();

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, invoice_id")
    .eq("id", jobId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (jobError) {
    logError("Invoice create job lookup failed", jobError);
    return errorResponse(jobError.message || "Failed to load job", 500);
  }
  if (!job) return badRequest("Job not found.");
  if (job.invoice_id) return badRequest("Invoice already exists for this job.");

  const { data: propertyManager, error: pmError } = await supabase
    .from("property_managers")
    .select("id")
    .eq("id", propertyManagerId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (pmError) {
    logError("Invoice create property manager lookup failed", pmError);
    return errorResponse(pmError.message || "Failed to load property manager", 500);
  }
  if (!propertyManager) return badRequest("Property manager not found.");

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("slug")
    .eq("id", profile.tenant_id)
    .single();

  if (tenantError || !tenant) {
    logError("Invoice create tenant lookup failed", tenantError);
    return errorResponse(tenantError?.message || "Failed to load tenant context", 500);
  }

  const sanitizedLineItems = lineItems.map((item) => {
    const quantity = Number(item.quantity);
    const unit_price = Number(item.unit_price);
    const total = Math.round((quantity * unit_price + Number.EPSILON) * 100) / 100;
    return {
      description: item.description.trim(),
      quantity,
      unit_price,
      total,
    };
  });

  const subtotal = sanitizedLineItems.reduce((sum, item) => sum + item.total, 0);
  const taxRateValue = taxRate ?? 0;
  const taxAmount = Math.round((subtotal * taxRateValue / 100 + Number.EPSILON) * 100) / 100;
  const total = Math.round((subtotal + taxAmount + Number.EPSILON) * 100) / 100;

  const { count, error: countError } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id);

  if (countError) {
    logError("Invoice create count lookup failed", countError);
    return errorResponse(countError.message || "Failed to calculate invoice number", 500);
  }

  const invoiceNumber = generateInvoiceNumber(tenant.slug, (count ?? 0) + 1);

  const { data: invoice, error: insertError } = await supabase
    .from("invoices")
    .insert({
      tenant_id: profile.tenant_id,
      job_id: jobId,
      property_manager_id: propertyManagerId,
      invoice_number: invoiceNumber,
      status,
      line_items: sanitizedLineItems,
      subtotal,
      tax_rate: taxRateValue,
      tax_amount: taxAmount,
      total,
      due_date: dueDate,
      notes: notes?.trim() || null,
    })
    .select("id")
    .single();

  if (insertError || !invoice) {
    logError("Invoice create insert failed", insertError);
    return errorResponse(insertError?.message || "Failed to create invoice", 500);
  }

  const { error: updateError } = await supabase
    .from("jobs")
    .update({ invoice_id: invoice.id, status: "invoiced" })
    .eq("id", jobId);

  if (updateError) {
    logError("Invoice create job update failed", updateError);
    return errorResponse(updateError.message || "Failed to update job after invoice creation", 500);
  }

  return jsonResponse({ success: true, invoiceId: invoice.id }, 201);
}
