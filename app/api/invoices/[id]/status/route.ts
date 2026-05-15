import { NextRequest } from "next/server";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { logError } from "@/lib/logger";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireOwner();
  const body = await req.json();
  const { status } = body;

  if (!["draft", "sent", "paid", "overdue"].includes(status)) {
    return badRequest("Invalid status");
  }

  const supabase = await createServerSideClient();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .select("id")
    .single();

  if (error) {
    logError("Invoice status update failed", error);
    return errorResponse("Failed to update invoice", 500);
  }

  return jsonResponse({ success: true });
}
