import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireOwner } from "@/lib/auth";
import { validateInput, workOrderActionSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/api";
import { checkPlanForApi } from "@/lib/plan";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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
        .select("id, title, property_managers(email, full_name)")
        .eq("id", workOrderId)
        .eq("tenant_id", tenantId)
        .single();

      if (!wo) return errorResponse("Work order not found", 404);

      const { error } = await supabase
        .from("work_orders")
        .update({ status: "declined" })
        .eq("id", workOrderId);

      if (error) return errorResponse("Failed to decline work order", 500);

      // Notify PM of decline (best-effort)
      if (resend && process.env.EMAIL_FROM) {
        const pm = Array.isArray(wo.property_managers) ? wo.property_managers[0] : (wo as any).property_managers;
        if (pm?.email) {
          resend.emails.send({
            from: process.env.EMAIL_FROM!,
            to: pm.email,
            subject: `Work order declined: ${wo.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 560px; color: #0f1923;">
                <div style="background: #0f1923; padding: 18px 20px; border-radius: 10px 10px 0 0;">
                  <span style="font-size: 20px; font-weight: 800; color: #f59e0b; letter-spacing: 1px;">FOREMAN</span>
                  <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0;">Your contractor reviewed your request</p>
                </div>
                <div style="background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                  <p style="margin: 0 0 10px; font-weight: 700; font-size: 16px;">${wo.title}</p>
                  <p style="margin:0; color:#6b7280;">This request was declined. Reply to discuss next steps.</p>
                </div>
              </div>
            `,
          }).catch(() => {});
        }
      }

      return NextResponse.json({ success: true });
    }

    if (action === "accept") {
      // Verify work order and get details
      const { data: wo } = await supabase
        .from("work_orders")
        .select("title, description, property_id, priority, property_manager_id, properties(name), property_managers(full_name, email)")
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

      // Notify PM that work is scheduled/accepted (best-effort)
      if (resend && process.env.EMAIL_FROM) {
        const pm = Array.isArray(wo.property_managers)
          ? wo.property_managers[0]
          : (wo as any).property_managers;
        if (pm?.email) {
          const prop = (Array.isArray(wo.properties) ? wo.properties[0] : (wo as any).properties) as
            | { name?: string }
            | null
            | undefined;
          resend.emails.send({
            from: process.env.EMAIL_FROM!,
            to: pm.email,
            subject: `Work order accepted: ${wo.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 560px; color: #0f1923;">
                <div style="background: #0f1923; padding: 18px 20px; border-radius: 10px 10px 0 0;">
                  <span style="font-size: 20px; font-weight: 800; color: #f59e0b; letter-spacing: 1px;">FOREMAN</span>
                  <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0;">Your contractor accepted your request</p>
                </div>
                <div style="background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                  <p style="margin: 0 0 10px; font-weight: 700; font-size: 16px;">${wo.title}</p>
                  ${prop?.name ? `<p style="margin:0 0 8px; color:#6b7280;">Property: ${prop.name}</p>` : ""}
                  <p style="margin:0; color:#6b7280;">We'll follow up with schedule details soon.</p>
                </div>
              </div>
            `,
          }).catch(() => {});
        }
      }

      return NextResponse.json({ success: true, jobId: job.id });
    }

    return errorResponse("Invalid action", 400);
  } catch (error) {
    console.error("Work order action error:", error);
    return errorResponse("Internal server error", 500);
  }
}
