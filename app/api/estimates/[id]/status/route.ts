import { NextRequest } from "next/server";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { logError } from "@/lib/logger";
import { z } from "zod";
import { validateInput } from "@/lib/validation";

const schema = z.object({
  status: z.enum(["draft", "sent", "approved", "declined"]),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireOwner();
  const body = await req.json();
  const validation = validateInput(schema, body);
  if (!validation.success) return badRequest((validation as { error: string }).error);

  const supabase = await createServerSideClient();

  const { data: estimate } = await supabase
    .from("estimates")
    .select("id, status")
    .eq("id", params.id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!estimate) return badRequest("Estimate not found.");
  if (estimate.status === "converted") return badRequest("Cannot change status of a converted estimate.");

  const { error } = await supabase
    .from("estimates")
    .update({ status: validation.data.status })
    .eq("id", params.id);

  if (error) {
    logError("Estimate status update failed", error);
    return errorResponse("Failed to update estimate.", 500);
  }

  return jsonResponse({ success: true });
}
