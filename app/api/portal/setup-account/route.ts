import { NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase";
import { errorResponse, jsonResponse } from "@/lib/api";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (!(await checkRateLimit(`portal-setup:${ip}`, 5, 15 * 60 * 1000))) {
      return errorResponse("Too many attempts. Please wait 15 minutes and try again.", 429);
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return errorResponse("Invalid input.", 400);

    const { token, password } = parsed.data;
    const supabase = createServiceClient();

    const { data: pm } = await supabase
      .from("property_managers")
      .select("id, tenant_id, full_name, email, phone, profile_id, setup_token_expires_at, is_active")
      .eq("setup_token", token)
      .single();

    if (!pm) return errorResponse("Invalid or expired setup link.", 404);
    if (pm.is_active === false) return errorResponse("Portal access has been revoked.", 403);
    if (pm.profile_id) return errorResponse("This portal account is already set up. Please sign in instead.", 409);
    if (!pm.email) return errorResponse("This property manager record is missing an email address.", 400);
    if (!pm.setup_token_expires_at || new Date(pm.setup_token_expires_at).getTime() <= Date.now()) {
      return errorResponse("This setup link has expired. Ask your contractor to send a new one.", 410);
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: pm.email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      console.error("auth.admin.createUser failed:", authError?.message, authError?.status);
      const msg = authError?.message?.toLowerCase() ?? "";
      const isDuplicate = msg.includes("already registered")
        || msg.includes("duplicate")
        || msg.includes("already exists")
        || authError?.status === 422;
      return errorResponse(
        isDuplicate
          ? "An account already exists for this email. Sign in or reset your password."
          : "Failed to create portal account.",
        400
      );
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authData.user.id,
        tenant_id: pm.tenant_id,
        email: pm.email,
        full_name: pm.full_name,
        role: "property_manager",
        phone: pm.phone || null,
        is_active: true,
      });

    if (profileError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return errorResponse("Failed to create portal profile.", 500);
    }

    const { error: linkError } = await supabase
      .from("property_managers")
      .update({
        profile_id: authData.user.id,
        setup_token: null,
        setup_token_expires_at: null,
      })
      .eq("id", pm.id);

    if (linkError) {
      await supabase.from("profiles").delete().eq("id", authData.user.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return errorResponse("Failed to link portal account.", 500);
    }

    return jsonResponse({ success: true, email: pm.email });
  } catch (error) {
    console.error("portal setup error", error);
    return errorResponse("Internal server error.", 500);
  }
}
