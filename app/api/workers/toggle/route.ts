import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireOwner } from "@/lib/auth";
import { validateInput, toggleWorkerSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const profile = await requireOwner();
    if (!profile) return errorResponse("Unauthorized", 401);

    const body = await req.json();
    const validation = validateInput(toggleWorkerSchema, body);
    if (!validation.success) return errorResponse((validation as any).error, 400);

    const { workerId, isActive } = validation.data;

    const supabase = createServiceClient();

    // Ensure worker belongs to owner's tenant
    const { data: worker } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", workerId)
      .eq("role", "worker")
      .single();

    if (!worker || worker.tenant_id !== profile.tenant_id) {
      return errorResponse("Worker not found or access denied", 404);
    }

    const { error } = await supabase
      .from("profiles")
      .update({ is_active: isActive })
      .eq("id", workerId);

    if (error) return errorResponse("Failed to update worker status", 500);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Toggle worker error:", error);
    return errorResponse("Internal server error", 500);
  }
}
