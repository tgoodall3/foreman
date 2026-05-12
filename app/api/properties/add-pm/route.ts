import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireOwner } from "@/lib/auth";
import { validateInput, uuidSchema, nameSchema, emailSchema, phoneSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/api";
import { logError } from "@/lib/logger";
import { z } from "zod";

const addPMSchema = z.object({
  tenantId: uuidSchema,
  fullName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  company: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const profile = await requireOwner();
    if (!profile) return errorResponse("Unauthorized", 401);

    const body = await req.json();
    const validation = validateInput(addPMSchema, body);
    if (!validation.success) return errorResponse((validation as any).error, 400);

    const { tenantId, fullName, email, phone, company } = validation.data;

    // Ensure tenant matches owner's tenant
    if (tenantId !== profile.tenant_id) {
      return errorResponse("Access denied", 403);
    }

    const supabase = createServiceClient();

    const { data: existingPm } = await supabase
      .from("property_managers")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("email", email)
      .maybeSingle();

    if (existingPm) {
      return NextResponse.json({ pm: existingPm, reused: true });
    }

    const { data: pm, error } = await supabase
      .from("property_managers")
      .insert({
        tenant_id: tenantId,
        full_name: fullName,
        email,
        phone: phone || null,
        company: company || null
      })
      .select()
      .single();

    if (error) return errorResponse("Failed to create property manager", 500);

    return NextResponse.json({ pm });
  } catch (error) {
    logError("Add PM error", error);
    return errorResponse("Internal server error", 500);
  }
}
