import { NextRequest } from "next/server";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { generateChangeOrderNumber } from "@/lib/utils";
import { logError } from "@/lib/logger";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  const profile = await requireOwner();
  const body = await req.json();

  const { jobId, title, description, lineItems, taxRate, notes } = body;
  if (!jobId || !title?.trim()) return badRequest("jobId and title are required.");
  if (!Array.isArray(lineItems) || lineItems.length === 0) return badRequest("At least one line item is required.");
  if (lineItems.some((l: any) => !l.description?.trim())) return badRequest("All line items need a description.");

  const supabase = await createServerSideClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, property_manager_id")
    .eq("id", jobId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!job) return badRequest("Job not found.");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("slug")
    .eq("id", profile.tenant_id)
    .single();

  if (!tenant) return errorResponse("Tenant not found.", 500);

  const { count } = await supabase
    .from("change_orders")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id);

  const sanitized = lineItems.map((item: any) => {
    const quantity   = Number(item.quantity);
    const unit_price = Number(item.unit_price);
    const total      = Math.round((quantity * unit_price + Number.EPSILON) * 100) / 100;
    return { description: String(item.description).trim(), quantity, unit_price, total };
  });

  const subtotal   = sanitized.reduce((sum: number, i: any) => sum + i.total, 0);
  const taxRateVal = Number(taxRate) || 0;
  const taxAmount  = Math.round((subtotal * taxRateVal / 100 + Number.EPSILON) * 100) / 100;
  const total      = Math.round((subtotal + taxAmount + Number.EPSILON) * 100) / 100;

  const { data: co, error } = await supabase
    .from("change_orders")
    .insert({
      tenant_id:           profile.tenant_id,
      job_id:              jobId,
      property_manager_id: job.property_manager_id ?? null,
      change_order_number: generateChangeOrderNumber(tenant.slug, (count ?? 0) + 1),
      title:               title.trim(),
      description:         description?.trim() || null,
      line_items:          sanitized,
      subtotal,
      tax_rate:            taxRateVal,
      tax_amount:          taxAmount,
      total,
      notes:               notes?.trim() || null,
      approval_token:      randomBytes(32).toString("hex"),
    })
    .select("id")
    .single();

  if (error || !co) {
    logError("Change order create failed", error);
    return errorResponse("Failed to create change order.", 500);
  }

  return jsonResponse({ success: true, changeOrderId: co.id }, 201);
}
