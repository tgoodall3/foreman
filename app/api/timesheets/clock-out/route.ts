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

    // Atomic update — only closes an entry that is still open for this worker.
    // Avoids a TOCTOU race where two concurrent requests both see an open entry.
    const { data: entry, error } = await supabase
      .from("time_entries")
      .update({
        clocked_out_at: new Date().toISOString(),
        notes: notes ?? null,
      })
      .eq("worker_id", profile.id)
      .is("clocked_out_at", null)
      .select()
      .maybeSingle();

    if (!entry) {
      return errorResponse("Not currently clocked in.", 409);
    }

    if (error) return errorResponse("Failed to clock out.", 500);

    return NextResponse.json({ entry });
  } catch {
    return errorResponse("Internal server error.", 500);
  }
}
