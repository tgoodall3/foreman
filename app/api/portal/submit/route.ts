import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { createServiceClient } from "@/lib/supabase";
import { validateInput, portalSubmitSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/api";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateInput(portalSubmitSchema, body);
    if (!validation.success) {
      return errorResponse((validation as any).error, 400);
    }

    const { property_manager_id, tenant_id, property_id, title, description, priority } = validation.data;

    // Rate limit: 5 submissions per PM per hour
    const rateLimitResult = await rateLimit(property_manager_id);
    if (!rateLimitResult.success) {
      return errorResponse("Too many submissions. Please wait before submitting again.", 429);
    }

    const supabase = createServiceClient();

    // Verify property manager and property belong to tenant
    const { data: pm } = await supabase
      .from("property_managers")
      .select("id, full_name, email")
      .eq("id", property_manager_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!pm) return errorResponse("Property manager not found", 404);

    const { data: prop } = await supabase
      .from("properties")
      .select("id, name, address")
      .eq("id", property_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!prop) return errorResponse("Property not found", 404);

    // Insert work order
    const { data: workOrder, error } = await supabase
      .from("work_orders")
      .insert({
        tenant_id,
        property_id,
        property_manager_id,
        title: title.trim(),
        description: description.trim(),
        priority,
        status: "pending",
      })
      .select("*, properties(name, address), property_managers(full_name, email)")
      .single();

    if (error) return errorResponse("Failed to create work order", 500);

    // Get owner email + tenant name
    const [{ data: owner }, { data: tenant }] = await Promise.all([
      supabase.from("profiles").select("email, full_name").eq("tenant_id", tenant_id).eq("role", "owner").single(),
      supabase.from("tenants").select("name").eq("id", tenant_id).single(),
    ]);

    const tenantName = tenant?.name || "Foreman";
    const fromAddress = `${tenantName} <${process.env.EMAIL_FROM!}>`;

    // Send notification to owner
    if (owner?.email && process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: fromAddress,
        to: owner.email,
        subject: `New Work Order: ${title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 560px;">
            <h2 style="color: #0f1923;">New Work Order Submitted</h2>
            <p><strong>From:</strong> ${workOrder.property_managers?.full_name}</p>
            <p><strong>Property:</strong> ${workOrder.properties?.name} — ${workOrder.properties?.address}</p>
            <p><strong>Priority:</strong> ${priority.toUpperCase()}</p>
            <h3>${title}</h3>
            <p>${description}</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/owner/work-orders/${workOrder.id}" 
               style="display:inline-block; background:#f59e0b; color:#0f1923; padding:10px 20px; border-radius:8px; font-weight:700; text-decoration:none; margin-top:16px;">
              View Work Order →
            </a>
          </div>
        `,
      });

      // Send confirmation to property manager
      if (workOrder.property_managers?.email) {
        await resend.emails.send({
          from: fromAddress,
          to: workOrder.property_managers.email,
          subject: `Work Order Received: ${title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 560px;">
              <h2 style="color: #0f1923;">Work Order Received</h2>
              <p>Hi ${workOrder.property_managers.full_name},</p>
              <p>Your work order has been submitted and will be reviewed shortly.</p>
              <p><strong>Property:</strong> ${workOrder.properties?.name}</p>
              <p><strong>Issue:</strong> ${title}</p>
              <p><strong>Priority:</strong> ${priority}</p>
              <p>You'll receive updates as work progresses.</p>
            </div>
          `,
        });
      }
    }

    return NextResponse.json({ success: true, workOrder });
  } catch (error) {
    console.error("Portal submit error:", error);
    return errorResponse("Internal server error", 500);
  }
}
