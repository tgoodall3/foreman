import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
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

    const supabase = createClient();

    // Verify current password by attempting sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

    if (signInError) return errorResponse("Current password is incorrect", 400);

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) return errorResponse("Failed to update password", 500);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Change password error:", error);
    return errorResponse("Internal server error", 500);
  }
}