import { NextRequest, NextResponse } from "next/server";
import { requireWorker } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { errorResponse } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const profile = await requireWorker();
    const supabase = await createServerSideClient();

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
      })
      .select()
      .single();

    if (error) return errorResponse("Failed to clock in.", 500);

    return NextResponse.json({ entry });
  } catch {
    return errorResponse("Internal server error.", 500);
  }
}
