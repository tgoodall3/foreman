import { NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { createServerSideClient } from "@/lib/supabase-server";
import { validateInput } from "@/lib/validation";
import { z } from "zod";

const schema = z.object({
  scheduled_date: z.string().optional().nullable(),
  scheduled_time: z.string().optional().nullable(),
  assigned_workers: z.array(z.string().uuid()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile || profile.role !== "owner") return badRequest("Unauthorized");

  const body = await req.json();
  const validation = validateInput(schema, body);
  if (!validation.success) return badRequest((validation as any).error);

  const { scheduled_date, scheduled_time, assigned_workers } = validation.data;

  const supabase = await createServerSideClient();

  // Verify job belongs to tenant
  const { data: job } = await supabase
    .from("jobs")
    .select("id, tenant_id")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!job) return badRequest("Job not found");

  // Verify all supplied worker IDs belong to this tenant
  if (assigned_workers?.length) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("id", assigned_workers)
      .eq("tenant_id", profile.tenant_id)
      .eq("role", "worker");
    if ((count ?? 0) !== assigned_workers.length) {
      return badRequest("One or more workers not found.");
    }
  }

  const updates: Record<string, any> = {};
  if (scheduled_date !== undefined) updates.scheduled_date = scheduled_date || null;
  if (scheduled_time !== undefined) updates.scheduled_time = scheduled_time || null;
  if (assigned_workers !== undefined) updates.assigned_workers = assigned_workers;

  const { error } = await supabase
    .from("jobs")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);

  if (error) return errorResponse("Failed to update job", 500);

  return jsonResponse({ success: true });
}
