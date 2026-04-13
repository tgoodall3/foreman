import { NextRequest } from "next/server";
import { createServerSideClient } from "@/lib/supabase-server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { logError } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`signin:${ip}`, 10, 15 * 60 * 1000))) {
    return errorResponse("Too many sign-in attempts. Please wait 15 minutes and try again.", 429);
  }

  const body = await req.json();
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return badRequest("Email and password are required.");
  }

  try {
    const supabase = await createServerSideClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return errorResponse(error?.message || "Unable to sign in.", 401);
    }

    if (!data.user.email_confirmed_at) {
      return errorResponse("Please verify your email address before signing in. Check your inbox for a confirmation link.", 403);
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile, error: profileError } = await serviceSupabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      logError("Failed to load profile after signin", profileError);
      return errorResponse(profileError?.message || "Signed in, but unable to load profile.", 500);
    }

    if (!profile.is_active) {
      return errorResponse("Account is not active.", 403);
    }

    return jsonResponse({ user: { id: data.user.id, email: data.user.email }, role: profile.role });
  } catch (error) {
    logError("Signin route failed", error);
    return errorResponse("Unable to sign in at this time.", 500);
  }
}
