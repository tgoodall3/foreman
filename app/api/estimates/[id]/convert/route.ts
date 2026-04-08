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
  if (estimate.status === "converted") return badRequest("Estimate has already been converted.");
  if (estimate.status === "declined")  return badRequest("Cannot convert a declined estimate.");

  // Create the job from the estimate
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      tenant_id:   profile.tenant_id,
      property_id: estimate.property_id ?? null,
      title:       estimate.title,
      description: estimate.description ?? null,
      status:      "pending",
      priority:    "normal",
      line_items:  estimate.line_items,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    logError("Estimate convert job insert failed", jobError);
    return errorResponse("Failed to create job.", 500);
  }

  // Mark estimate as converted and link to the new job
  const { error: updateError } = await supabase
    .from("estimates")
    .update({ status: "converted", job_id: job.id })
    .eq("id", params.id);

  if (updateError) {
    logError("Estimate convert status update failed", updateError);
    return errorResponse("Job created but failed to update estimate.", 500);
  }

  return jsonResponse({ success: true, jobId: job.id });
}
