import { NextRequest } from "next/server";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { getProfile } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { logError } from "@/lib/logger";
import { z } from "zod";
import { validateInput } from "@/lib/validation";
import { maybeCreateNextOccurrence } from "@/lib/recurring";

const schema = z.object({
  actual_hours: z.number().min(0).max(999),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile) return badRequest("Unauthorized");

  const body = await req.json();
  const validation = validateInput(schema, body);
  if (!validation.success) return badRequest((validation as { error: string }).error);

  const supabase = await createServerSideClient();

  // Verify job belongs to this tenant; workers can only update jobs assigned to them
  const { data: job } = await supabase
    .from("jobs")
    .select("id, tenant_id, assigned_workers")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!job) return badRequest("Job not found.");

  if (profile.role === "worker" && !job.assigned_workers?.includes(profile.id)) {
    return badRequest("Not assigned to this job.");
  }

  const { error } = await supabase
    .from("jobs")
    .update({ actual_hours: validation.data.actual_hours })
    .eq("id", id);

  if (error) {
    logError("Hours update failed", error);
    return errorResponse("Failed to update hours.", 500);
  }

  // Fire-and-forget: create next occurrence if this is a recurring job
  maybeCreateNextOccurrence(supabase as any, id, profile.tenant_id).catch(() => {});

  return jsonResponse({ success: true });
}
