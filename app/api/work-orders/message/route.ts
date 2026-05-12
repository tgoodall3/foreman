import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { requireOwner } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";
import { errorResponse } from "@/lib/api";
import { logError } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { getFromAddress, renderDetailCard, renderEmailLayout, renderMessageCard, renderNoticeCard } from "@/lib/email";

const messageSchema = z.object({
  workOrderId: z.string().uuid(),
  message: z.string().min(1).max(1000).trim(),
});

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req: NextRequest) {
  try {
    const profile = await requireOwner();
    if (!profile) return errorResponse("Unauthorized", 401);

    if (!(await checkRateLimit(`wo-message:${profile.id}`, 30, 60 * 60 * 1000))) {
      return errorResponse("Too many messages. Please wait before sending again.", 429);
    }

    const parsed = messageSchema.safeParse(await req.json());
    if (!parsed.success) {
      return errorResponse(parsed.error.issues.map((i) => i.message).join(", "), 400);
    }

    const { workOrderId, message } = parsed.data;
    const supabase = createServiceClient();

    const { data: wo } = await supabase
      .from("work_orders")
      .select("id, title, tenant_id, property_manager_id, properties(name), property_managers(full_name, email, portal_token)")
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
      const { data: tenant } = await supabase.from("tenants").select("name").eq("id", wo.tenant_id).single();
      const tenantName = tenant?.name || "Foreman";
      const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

      await resend.emails.send({
        from: getFromAddress(tenantName),
        to: pm.email,
        subject: `Message about work order: ${wo.title}`,
        html: renderEmailLayout({
          tenantName,
          category: "Work Order Message",
          title: "New message about your work order",
          greeting: `Hi ${pm.full_name || "there"},`,
          intro: `${profile.full_name || tenantName} sent a message about one of your work orders.`,
          previewText: `New message on ${wo.title}.`,
          sections: [
            renderNoticeCard({
              tone: "neutral",
              eyebrow: "Work order",
              title: wo.title,
              bodyHtml: property?.name ? `Property: ${property.name}` : undefined,
            }),
            renderDetailCard("Conversation details", [
              { label: "From", value: profile.full_name || "Owner" },
              { label: "Property", value: property?.name || "" },
            ]),
            renderMessageCard("Message", message),
          ],
          primaryAction: pm.portal_token
            ? {
                href: `${appUrl}/portal?token=${encodeURIComponent(pm.portal_token)}`,
                label: "Open portal",
              }
            : undefined,
          footerText: "Reply to this email if you need to continue the conversation.",
        }),
      }).catch((err) => console.error("[email] work order message:", err));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("work-orders/message error", error);
    return errorResponse("Internal server error", 500);
  }
}
