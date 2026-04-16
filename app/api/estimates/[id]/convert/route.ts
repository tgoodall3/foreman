import { NextRequest } from "next/server";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { logError } from "@/lib/logger";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: estimate } = await supabase
    .from("estimates")
    .select("*")
    .eq("id", params.id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!estimate) return badRequest("Estimate not found.");
  if (estimate.status === "declined") return badRequest("Cannot convert a declined estimate.");

  // Create the job from the estimate
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      tenant_id:   profile.tenant_id,
      property_id: estimate.property_id ?? null,
      title:       estimate.title,
      description:         estimate.description ?? null,
      status:              "pending",
      priority:            "normal",
      line_items:          estimate.line_items,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    logError("Estimate convert job insert failed", jobError);
    return errorResponse("Failed to create job.", 500);
  }

  // Atomically mark as converted only if it hasn't been converted yet.
  // This prevents a duplicate job from a race condition.
  const { data: updated, error: updateError } = await supabase
    .from("estimates")
    .update({ status: "converted", job_id: job.id })
    .eq("id", params.id)
    .in("status", ["draft", "approved"])  // allow converting approved estimates too
    .neq("status", "converted")
    .select("id")
    .maybeSingle();

  if (updateError) {
    logError("Estimate convert status update failed", updateError);
    // Roll back the orphaned job
    await supabase.from("jobs").delete().eq("id", job.id);
    return errorResponse("Job created but failed to update estimate.", 500);
  }

  if (!updated) {
    // Another request already converted it — clean up the duplicate job
    await supabase.from("jobs").delete().eq("id", job.id);
    return badRequest("Estimate has already been converted.");
  }

  return jsonResponse({ success: true, jobId: job.id });
}
