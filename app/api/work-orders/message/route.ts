import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { requireOwner } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";
import { errorResponse } from "@/lib/api";

const messageSchema = z.object({
  workOrderId: z.string().uuid(),
  message: z.string().min(1).max(1000).trim(),
});

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req: NextRequest) {
  try {
    const profile = await requireOwner();
    if (!profile) return errorResponse("Unauthorized", 401);

    const parsed = messageSchema.safeParse(await req.json());
    if (!parsed.success) {
      return errorResponse(parsed.error.issues.map((i) => i.message).join(", "), 400);
    }

    const { workOrderId, message } = parsed.data;
    const supabase = createServiceClient();

    const { data: wo } = await supabase
      .from("work_orders")
      .select("id, title, tenant_id, property_manager_id, properties(name), property_managers(full_name, email)")
      .eq("id", workOrderId)
      .single();

    if (!wo || wo.tenant_id !== profile.tenant_id) {
      return errorResponse("Not found", 404);
    }

    const pm = Array.isArray(wo.property_managers)
      ? wo.property_managers[0]
      : (wo as any).property_managers;

    const property = Array.isArray(wo.properties) ? wo.properties[0] : (wo as any).properties;

    if (resend && pm?.email && process.env.EMAIL_FROM) {
      await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: pm.email,
        subject: `Message about work order: ${wo.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; color: #0f1923;">
            <div style="background: #0f1923; padding: 16px 18px; border-radius: 10px 10px 0 0;">
              <span style="font-size: 18px; font-weight: 800; color: #f59e0b; letter-spacing: 1px;">FOREMAN</span>
              <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0;">${profile.full_name || "Owner"} left a note</p>
            </div>
            <div style="background: #fff; padding: 18px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="margin: 0 0 8px; font-weight: 700;">${wo.title}</p>
              ${property?.name ? `<p style="margin:0 0 6px; color:#6b7280;">Property: ${property.name}</p>` : ""}
              <p style="margin:12px 0 4px; font-size: 14px; white-space: pre-wrap;">${message}</p>
            </div>
          </div>
        `,
      }).catch((err) => console.error("[email] work order message:", err));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("work-orders/message error", error);
    return errorResponse("Internal server error", 500);
  }
}
