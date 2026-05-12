import { errorResponse, jsonResponse } from "@/lib/api";
import { requireWorker } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { logError } from "@/lib/logger";

export async function GET() {
  const profile = await requireWorker();
  const supabase = await createServerSideClient();

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, title")
    .eq("tenant_id", profile.tenant_id)
    .contains("assigned_workers", [profile.id])
    .in("status", ["pending", "scheduled", "in_progress"])
    .order("scheduled_date", { ascending: true, nullsFirst: false });

  if (error) {
    logError("Worker jobs fetch failed", error);
    return errorResponse("Failed to fetch jobs.", 500);
  }

  return jsonResponse({ jobs: jobs ?? [] });
}
