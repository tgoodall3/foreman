import { NextRequest, NextResponse } from "next/server";
import { createServerSideClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { requireOwner } from "@/lib/auth";
import { validateInput } from "@/lib/validation";
import { errorResponse } from "@/lib/api";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const profile = await requireOwner();
    if (!profile) return errorResponse("Unauthorized", 401);

    const body = await req.json();
    const validation = validateInput(changePasswordSchema, body);
    if (!validation.success) return errorResponse((validation as any).error, 400);

    const { currentPassword, newPassword } = validation.data;

    // Verify current password using server-side client (has access to cookies/session)
    const supabase = await createServerSideClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

    if (signInError) return errorResponse("Current password is incorrect", 400);

    // Update password using service client (admin API, no session dependency)
    const serviceClient = createServiceClient();
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    );

    if (updateError) return errorResponse("Failed to update password", 500);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Change password error:", error);
    return errorResponse("Internal server error", 500);
  }
}