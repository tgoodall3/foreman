import { NextRequest, NextResponse } from "next/server";
import { requireWorker } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { errorResponse } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const profile = await requireWorker();
    const body = await req.json().catch(() => ({}));
    const notes: string | undefined = body.notes?.trim() || undefined;

    const supabase = await createServerSideClient();

    // Find the open entry
    const { data: open } = await supabase
      .from("time_entries")
      .select("id")
      .eq("worker_id", profile.id)
      .is("clocked_out_at", null)
      .maybeSingle();

    if (!open) {
      return errorResponse("Not currently clocked in.", 409);
    }

    const { data: entry, error } = await supabase
      .from("time_entries")
      .update({
        clocked_out_at: new Date().toISOString(),
        notes: notes ?? null,
      })
      .eq("id", open.id)
      .select()
      .single();

    if (error) return errorResponse("Failed to clock out.", 500);

    return NextResponse.json({ entry });
  } catch {
    return errorResponse("Internal server error.", 500);
  }
}
