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

  if (!status || !["draft", "sent", "approved", "declined"].includes(status)) {
    return badRequest("Invalid status.");
  }

  const supabase = await createServerSideClient();

  const { data: existing } = await supabase
    .from("change_orders")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!existing) return badRequest("Change order not found.");

  const { error } = await supabase
    .from("change_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) {
    logError("Change order status update failed", error);
    return errorResponse("Failed to update change order.", 500);
  }

  return jsonResponse({ success: true });
}
