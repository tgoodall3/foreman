import { NextRequest } from "next/server";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { logError } from "@/lib/logger";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireOwner();
  const body = await req.json();
  const rate = body.hourly_rate === null || body.hourly_rate === "" ? null : Number(body.hourly_rate);

  if (rate !== null && (isNaN(rate) || rate < 0)) {
    return badRequest("Hourly rate must be a non-negative number.");
  }

  const supabase = await createServerSideClient();

  const { data: worker } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .eq("role", "worker")
    .single();

  if (!worker) return badRequest("Worker not found.");

  const { error } = await supabase
    .from("profiles")
    .update({ hourly_rate: rate })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) {
    logError("Worker rate update failed", error);
    return errorResponse("Failed to update hourly rate.", 500);
  }

  return jsonResponse({ success: true });
}
