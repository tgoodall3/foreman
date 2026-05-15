import { NextRequest } from "next/server";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { logError } from "@/lib/logger";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; costId: string }> }) {
  const { id, costId } = await params;
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: existing } = await supabase
    .from("job_costs")
    .select("id")
    .eq("id", costId)
    .eq("job_id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!existing) return badRequest("Cost not found.");

  const { error } = await supabase
    .from("job_costs")
    .delete()
    .eq("id", costId)
    .eq("tenant_id", profile.tenant_id);

  if (error) {
    logError("Job cost delete failed", error);
    return errorResponse("Failed to delete cost.", 500);
  }

  return jsonResponse({ success: true });
}
