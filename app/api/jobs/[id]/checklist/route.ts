import { NextRequest } from "next/server";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { getProfile } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { logError } from "@/lib/logger";
import { z } from "zod";
import { validateInput } from "@/lib/validation";

const addSchema = z.object({
  text:     z.string().min(1).max(200).trim(),
  position: z.number().int().min(0).optional(),
});

const toggleSchema = z.object({
  itemId: z.string().uuid(),
  done:   z.boolean(),
});

const deleteSchema = z.object({
  itemId: z.string().uuid(),
});

// POST — add a checklist item (owner only)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getProfile();
  if (!profile || profile.role !== "owner") return badRequest("Owner access required.");

  const body = await req.json();
  const validation = validateInput(addSchema, body);
  if (!validation.success) return badRequest((validation as { error: string }).error);

  const supabase = await createServerSideClient();

  // Verify job belongs to tenant
  const { data: job } = await supabase
    .from("jobs").select("id").eq("id", params.id).eq("tenant_id", profile.tenant_id).single();
  if (!job) return badRequest("Job not found.");

  // Auto position at end if not specified
  let position = validation.data.position;
  if (position == null) {
    const { count } = await supabase
      .from("job_checklist_items")
      .select("id", { count: "exact", head: true })
      .eq("job_id", params.id);
    position = count ?? 0;
  }

  const { data: item, error } = await supabase
    .from("job_checklist_items")
    .insert({ job_id: params.id, tenant_id: profile.tenant_id, text: validation.data.text, position })
    .select("id, text, position, done, done_at")
    .single();

  if (error || !item) { logError("Checklist add failed", error); return errorResponse("Failed to add item.", 500); }
  return jsonResponse({ success: true, item }, 201);
}

// PATCH — toggle done (owner or assigned worker)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getProfile();
  if (!profile) return badRequest("Unauthorized.");

  const body = await req.json();
  const validation = validateInput(toggleSchema, body);
  if (!validation.success) return badRequest((validation as { error: string }).error);

  const supabase = await createServerSideClient();

  // Workers can only toggle items on their assigned jobs
  if (profile.role === "worker") {
    const { data: job } = await supabase
      .from("jobs").select("assigned_workers").eq("id", params.id).eq("tenant_id", profile.tenant_id).single();
    if (!job?.assigned_workers?.includes(profile.id)) return badRequest("Not assigned to this job.");
  }

  const { error } = await supabase
    .from("job_checklist_items")
    .update({
      done:    validation.data.done,
      done_by: validation.data.done ? profile.id : null,
      done_at: validation.data.done ? new Date().toISOString() : null,
    })
    .eq("id", validation.data.itemId)
    .eq("job_id", params.id);

  if (error) { logError("Checklist toggle failed", error); return errorResponse("Failed to update item.", 500); }
  return jsonResponse({ success: true });
}

// DELETE — remove an item (owner only)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getProfile();
  if (!profile || profile.role !== "owner") return badRequest("Owner access required.");

  const body = await req.json();
  const validation = validateInput(deleteSchema, body);
  if (!validation.success) return badRequest((validation as { error: string }).error);

  const supabase = await createServerSideClient();

  const { error } = await supabase
    .from("job_checklist_items")
    .delete()
    .eq("id", validation.data.itemId)
    .eq("job_id", params.id)
    .eq("tenant_id", profile.tenant_id);

  if (error) { logError("Checklist delete failed", error); return errorResponse("Failed to delete item.", 500); }
  return jsonResponse({ success: true });
}
