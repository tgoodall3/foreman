import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { errorResponse } from "@/lib/api";

export async function POST(req: NextRequest) {
  const owner = await requireOwner();
  if (!owner) return errorResponse("Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const { scheduled_date, scheduled_time, worker_ids } = body || {};
  if (!scheduled_date || !scheduled_time || !Array.isArray(worker_ids) || worker_ids.length === 0) {
    return errorResponse("Missing date/time/workers", 400);
  }

  const supabase = await createServerSideClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, scheduled_date, scheduled_time, assigned_workers")
    .eq("tenant_id", owner.tenant_id)
    .eq("scheduled_date", scheduled_date)
    .eq("scheduled_time", scheduled_time)
    .overlaps("assigned_workers", worker_ids);

  if (error) return errorResponse("Failed to check conflicts", 500);

  return NextResponse.json({ conflicts: data ?? [] });
}
