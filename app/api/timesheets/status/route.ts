import { NextRequest, NextResponse } from "next/server";
import { requireWorker } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { errorResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const profile = await requireWorker();
    const supabase = await createServerSideClient();

    const { data: entry } = await supabase
      .from("time_entries")
      .select("id, clocked_in_at, clocked_out_at, notes")
      .eq("worker_id", profile.id)
      .is("clocked_out_at", null)
      .maybeSingle();

    return NextResponse.json({ entry: entry ?? null });
  } catch {
    return errorResponse("Internal server error.", 500);
  }
}
