import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { errorResponse, jsonResponse } from "@/lib/api";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const token = form.get("token") as string | null;
  const status = form.get("status") as string | null;

  if (!token || !status || !["approved", "declined"].includes(status)) {
    return errorResponse("Invalid request", 400);
  }

  const supabase = createServiceClient();
  const { data: estimate, error } = await supabase
    .from("estimates")
    .select("id, tenant_id")
    .eq("approval_token", token)
    .single();

  if (error || !estimate) return errorResponse("Estimate not found", 404);

  const { error: updateError } = await supabase
    .from("estimates")
    .update({ status })
    .eq("id", estimate.id);

  if (updateError) return errorResponse("Could not update estimate", 500);

  return NextResponse.redirect(new URL(`/portal?tab=invoices&token=${token}&estimate=${estimate.id}&status=${status}`, req.url));
}
