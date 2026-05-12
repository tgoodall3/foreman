import { NextRequest, NextResponse } from "next/server";
import { requireWorker } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { errorResponse } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const profile = await requireWorker();
    const supabase = await createServerSideClient();

    const body = await req.json().catch(() => ({}));
    const jobId = body.job_id || null;

    // Validate job belongs to tenant if provided
    if (jobId) {
      const { data: job } = await supabase
        .from("jobs")
        .select("id")
        .eq("id", jobId)
        .eq("tenant_id", profile.tenant_id)
        .single();
      if (!job) return errorResponse("Job not found.", 404);
    }

    // Prevent double clock-in: check for open entry
    const { data: open } = await supabase
      .from("time_entries")
      .select("id")
      .eq("worker_id", profile.id)
      .is("clocked_out_at", null)
      .maybeSingle();

    if (open) {
      return errorResponse("Already clocked in.", 409);
    }

    const { data: entry, error } = await supabase
      .from("time_entries")
      .insert({
        tenant_id:     profile.tenant_id,
        worker_id:     profile.id,
        clocked_in_at: new Date().toISOString(),
        job_id:        jobId,
      })
      .select()
      .single();

    if (error) return errorResponse("Failed to clock in.", 500);

    return NextResponse.json({ entry });
  } catch {
    return errorResponse("Internal server error.", 500);
  }
}
