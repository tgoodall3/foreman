import { NextRequest } from "next/server";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { createOwnerAccount } from "@/lib/services/auth";
import { logError } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`signup:${ip}`, 3, 60 * 60 * 1000))) {
    return errorResponse("Too many sign-up attempts. Please wait an hour and try again.", 429);
  }

  const body = await req.json();
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const bizName = typeof body.bizName === "string" ? body.bizName.trim() : "";
  const bizPhone = typeof body.bizPhone === "string" ? body.bizPhone.trim() : undefined;
  const bizAddress = typeof body.bizAddress === "string" ? body.bizAddress.trim() : undefined;

  if (!fullName || !email || !password || !bizName) {
    return badRequest("Missing required fields.");
  }

  if (password.length < 8) {
    return badRequest("Password must be at least 8 characters.");
  }

  try {
    const tenant = await createOwnerAccount({ fullName, email, password, bizName, bizPhone, bizAddress });
    return jsonResponse({ success: true, tenantId: tenant.id });
  } catch (error: any) {
    logError("Signup failed", error);
    return errorResponse(error?.message || "Failed to create account.", 500);
  }
}
