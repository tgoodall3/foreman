import { NextRequest } from "next/server";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { logError } from "@/lib/logger";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireOwner();
  const body = await req.json();

  const { title, description, lineItems, taxRate, notes } = body;
  if (!title?.trim()) return badRequest("Title is required.");
  if (!Array.isArray(lineItems) || lineItems.length === 0) return badRequest("At least one line item is required.");

  const supabase = await createServerSideClient();

  const { data: existing } = await supabase
    .from("change_orders")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!existing) return badRequest("Change order not found.");
  if (existing.status !== "draft") return badRequest("Only draft change orders can be edited.");

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

  const { error } = await supabase
    .from("change_orders")
    .update({
      title:       title.trim(),
      description: description?.trim() || null,
      line_items:  sanitized,
      subtotal,
      tax_rate:    taxRateVal,
      tax_amount:  taxAmount,
      total,
      notes:       notes?.trim() || null,
      updated_at:  new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) {
    logError("Change order update failed", error);
    return errorResponse("Failed to update change order.", 500);
  }

  return jsonResponse({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: existing } = await supabase
    .from("change_orders")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!existing) return badRequest("Change order not found.");
  if (existing.status === "approved") return badRequest("Approved change orders cannot be deleted.");

  const { error } = await supabase
    .from("change_orders")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) {
    logError("Change order delete failed", error);
    return errorResponse("Failed to delete change order.", 500);
  }

  return jsonResponse({ success: true });
}
