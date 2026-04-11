import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireOwner } from "@/lib/auth";
import { validateInput, inviteWorkerSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/api";
import { checkPlanForApi } from "@/lib/plan";

export async function POST(req: NextRequest) {
  try {
    const profile = await requireOwner();
    if (!profile) return errorResponse("Unauthorized", 401);

    const planError = await checkPlanForApi(profile);
    if (planError) return planError;

    const body = await req.json();
    const validation = validateInput(inviteWorkerSchema, body);
    if (!validation.success) return errorResponse((validation as any).error, 400);

    const { tenantId, fullName, email, phone, password } = validation.data;

    // Ensure tenant matches owner's tenant
    if (tenantId !== profile.tenant_id) {
      return errorResponse("Access denied", 403);
    }

    const supabase = createServiceClient();

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
    });

    if (authError) {
      // Return a generic message — don't leak internal auth error details
      const isDuplicate = authError.message?.toLowerCase().includes("already registered")
        || authError.message?.toLowerCase().includes("duplicate");
      return errorResponse(isDuplicate ? "A worker with this email already exists." : "Failed to create worker account.", 400);
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authData.user.id,
        tenant_id: tenantId,
        email,
        full_name: fullName,
        role: "worker",
        phone: phone || null,
        is_active: true
      })
      .select()
      .single();

    if (profileError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return errorResponse("Failed to create worker profile", 500);
    }

    return NextResponse.json({ profile: profileData });
  } catch (error) {
    console.error("Invite worker error:", error);
    return errorResponse("Internal server error", 500);
  }
}
