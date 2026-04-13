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
  if (pm.is_active !== false) {
    return errorResponse("Revoke portal access before deleting this property manager.", 400);
  }

  const [
    { count: propertiesCount },
    { count: workOrdersCount },
    { count: invoicesCount },
    { count: estimatesCount },
  ] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("property_manager_id", propertyManagerId),
    supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("property_manager_id", propertyManagerId),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("property_manager_id", propertyManagerId),
    supabase.from("estimates").select("id", { count: "exact", head: true }).eq("property_manager_id", propertyManagerId),
  ]);

  const { error } = await supabase
    .from("property_managers")
    .delete()
    .eq("id", propertyManagerId);

  if (error) return errorResponse("Failed to delete property manager", 500);

  return NextResponse.json({
    ok: true,
    deletedCounts: {
      properties: propertiesCount ?? 0,
      workOrders: workOrdersCount ?? 0,
      invoices: invoicesCount ?? 0,
      estimates: estimatesCount ?? 0,
    },
  });
}
