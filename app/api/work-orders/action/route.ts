import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireOwner } from "@/lib/auth";
import { validateInput, workOrderActionSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/api";
import { checkPlanForApi } from "@/lib/plan";

export async function POST(req: NextRequest) {
  try {
    const profile = await requireOwner();
    if (!profile) return errorResponse("Unauthorized", 401);

    const planError = await checkPlanForApi(profile);
    if (planError) return planError;

    const body = await req.json();
    const validation = validateInput(workOrderActionSchema, body);
    if (!validation.success) return errorResponse((validation as any).error, 400);

    const { workOrderId, tenantId, action, title, description, propertyId } = validation.data;

    // Ensure tenant matches owner's tenant
    if (tenantId !== profile.tenant_id) {
      return errorResponse("Access denied", 403);
    }

    const supabase = createServiceClient();

    if (action === "decline") {
      // Verify work order belongs to tenant
      const { data: wo } = await supabase
        .from("work_orders")
        .select("id")
        .eq("id", workOrderId)
        .eq("tenant_id", tenantId)
        .single();

      if (!wo) return errorResponse("Work order not found", 404);

      const { error } = await supabase
        .from("work_orders")
        .update({ status: "declined" })
        .eq("id", workOrderId);

      if (error) return errorResponse("Failed to decline work order", 500);

      return NextResponse.json({ success: true });
    }

    if (action === "accept") {
      // Verify work order and get details
      const { data: wo } = await supabase
        .from("work_orders")
        .select("title, description, property_id, priority")
        .eq("id", workOrderId)
        .eq("tenant_id", tenantId)
        .single();

      if (!wo) return errorResponse("Work order not found", 404);

      // Smart-ish defaults: carry over priority, schedule for today, start as scheduled
      const today = new Date().toISOString().split("T")[0];

      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          tenant_id: tenantId,
          work_order_id: workOrderId,
          property_id: propertyId || wo.property_id,
          title: title || wo.title,
          description: description || wo.description,
          status: "scheduled",
          priority: wo.priority || "normal",
          scheduled_date: today,
          assigned_workers: [],
        })
        .select()
        .single();

      if (jobError) return errorResponse("Failed to create job", 500);

      // Update work order status and link job
      await supabase
        .from("work_orders")
        .update({ status: "accepted", job_id: job.id })
        .eq("id", workOrderId);

      return NextResponse.json({ success: true, jobId: job.id });
    }

    return errorResponse("Invalid action", 400);
  } catch (error) {
    console.error("Work order action error:", error);
    return errorResponse("Internal server error", 500);
  }
}
