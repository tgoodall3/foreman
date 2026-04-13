import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";
import { errorResponse } from "@/lib/api";

export async function POST(req: NextRequest) {
  const owner = await requireOwner();
  const { propertyManagerId } = await req.json();
  if (!propertyManagerId) return errorResponse("propertyManagerId is required", 400);

  const supabase = createServiceClient();

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, tenant_id, is_active")
    .eq("id", propertyManagerId)
    .single();

  if (!pm || pm.tenant_id !== owner.tenant_id) return errorResponse("Not found", 404);

  const { data, error } = await supabase
    .from("property_managers")
    .update({ is_active: !pm.is_active })
    .eq("id", propertyManagerId)
    .select("id, is_active")
    .single();

  if (error) return errorResponse("Failed to update access", 500);

  return NextResponse.json({ ok: true, is_active: data.is_active });
}
