import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireOwner } from "@/lib/auth";
import { validateInput, addPropertySchema } from "@/lib/validation";
import { errorResponse } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const profile = await requireOwner();
    if (!profile) return errorResponse("Unauthorized", 401);

    const body = await req.json();
    const validation = validateInput(addPropertySchema, body);
    if (!validation.success) return errorResponse((validation as any).error, 400);

    const { tenantId, propertyManagerId, name, address, city, state, zip, notes } = validation.data;

    // Ensure tenant matches owner's tenant
    if (tenantId !== profile.tenant_id) {
      return errorResponse("Access denied", 403);
    }

    const supabase = createServiceClient();

    // Verify property manager belongs to tenant
    const { data: pm } = await supabase
      .from("property_managers")
      .select("id")
      .eq("id", propertyManagerId)
      .eq("tenant_id", tenantId)
      .single();

    if (!pm) {
      return errorResponse("Property manager not found", 404);
    }

    const { data: property, error } = await supabase
      .from("properties")
      .insert({
        tenant_id: tenantId,
        property_manager_id: propertyManagerId,
        name,
        address,
        city,
        state,
        zip,
        notes: notes || null
      })
      .select()
      .single();

    if (error) return errorResponse("Failed to create property", 500);

    return NextResponse.json({ property });
  } catch (error) {
    console.error("Add property error:", error);
    return errorResponse("Internal server error", 500);
  }
}
