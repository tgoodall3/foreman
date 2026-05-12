import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireOwner } from "@/lib/auth";
import { validateInput, workOrderActionSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/api";
import { logError } from "@/lib/logger";
import { checkPlanForApi } from "@/lib/plan";
import { Resend } from "resend";
import { audit } from "@/lib/audit";
import { getFromAddress, renderDetailCard, renderEmailLayout, renderNoticeCard } from "@/lib/email";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function buildWorkOrderEmail({
  tenantName,
  woTitle,
  pmName,
  action,
  propertyName,
  portalUrl,
}: {
  tenantName: string;
  woTitle: string;
  pmName: string;
  action: "accepted" | "declined";
  propertyName?: string;
  portalUrl?: string;
}) {
  const isAccepted = action === "accepted";
  const subject = isAccepted
    ? `Work order accepted — ${woTitle}`
    : `Work order update — ${woTitle}`;

  const html = renderEmailLayout({
    tenantName,
    category: "Work Order Update",
    title: isAccepted ? "Your work order has been accepted" : "Work order update",
    greeting: `Hi ${pmName},`,
    intro: isAccepted
      ? `Your work order has been reviewed and accepted by ${tenantName}. You will receive another notification once a date has been scheduled.`
      : "Your work order was reviewed and unfortunately cannot be accommodated at this time. Please reply if you have questions or would like to discuss alternatives.",
    sections: [
      renderNoticeCard({
        tone: isAccepted ? "success" : "danger",
        eyebrow: isAccepted ? "Accepted" : "Declined",
        title: woTitle,
        body: propertyName ? `Property: ${propertyName}` : undefined,
      }),
    ],
    primaryAction: portalUrl && isAccepted ? { href: portalUrl, label: "View in Portal" } : undefined,
    footerText: "Questions? Reply to this email or visit your portal.",
  });

  return { subject, html };
}

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

    // Fetch tenant name once — used in emails for both accept and decline
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", profile.tenant_id)
      .single();
    const tenantName = tenantData?.name ?? "Foreman customer";

    if (action === "decline") {
      const { data: wo } = await supabase
        .from("work_orders")
        .select("id, title, property_managers(email, full_name, portal_token)")
        .eq("id", workOrderId)
        .eq("tenant_id", profile.tenant_id)
        .single();

      if (!wo) return errorResponse("Work order not found", 404);

      const { error } = await supabase
        .from("work_orders")
        .update({ status: "declined" })
        .eq("id", workOrderId);

      if (error) return errorResponse("Failed to decline work order", 500);

      audit({
        tenant_id: profile.tenant_id,
        actor_id: profile.id,
        actor_name: profile.full_name,
        entity_type: "work_order",
        entity_id: workOrderId,
        entity_label: wo.title,
        action: "declined",
      });

      if (resend) {
        const pm = Array.isArray(wo.property_managers) ? wo.property_managers[0] : (wo as any).property_managers;
        if (pm?.email) {
          const { subject, html } = buildWorkOrderEmail({
            tenantName,
            woTitle: wo.title,
            pmName: pm.full_name ?? "there",
            action: "declined",
          });
          await resend.emails.send({ from: getFromAddress(tenantName), to: pm.email, subject, html })
            .catch((err) => console.error("[email] work order declined:", err));
        }
      }

      return NextResponse.json({ success: true });
    }

    if (action === "accept") {
      // Verify work order and get details
      const { data: wo } = await supabase
        .from("work_orders")
        .select("status, title, description, property_id, priority, property_manager_id, properties(name), property_managers(full_name, email, portal_token)")
        .eq("id", workOrderId)
        .eq("tenant_id", profile.tenant_id)
        .single();

      if (!wo) return errorResponse("Work order not found", 404);
      if (wo.status !== "pending") return errorResponse("Work order is not pending.", 409);

      // Verify override propertyId belongs to this tenant
      let resolvedPropertyId = wo.property_id;
      if (propertyId) {
        const { data: prop } = await supabase
          .from("properties")
          .select("id")
          .eq("id", propertyId)
          .eq("tenant_id", profile.tenant_id)
          .single();
        if (!prop) return errorResponse("Property not found.", 404);
        resolvedPropertyId = propertyId;
      }

      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          tenant_id: profile.tenant_id,
          work_order_id: workOrderId,
          property_id: resolvedPropertyId,
          title: title || wo.title,
          description: description || wo.description,
          status: "pending",
          priority: wo.priority || "normal",
          assigned_workers: [],
        })
        .select()
        .single();

      if (jobError) return errorResponse("Failed to create job", 500);

      audit({
        tenant_id: profile.tenant_id,
        actor_id: profile.id,
        actor_name: profile.full_name,
        entity_type: "work_order",
        entity_id: workOrderId,
        entity_label: wo.title,
        action: "accepted",
        metadata: { job_id: job.id },
      });

      // Update work order status and link job
      await supabase
        .from("work_orders")
        .update({ status: "accepted", job_id: job.id })
        .eq("id", workOrderId);

      // Notify PM that their work order was accepted (awaited so the email
      // completes before the serverless function terminates)
      if (resend) {
        const pm = Array.isArray(wo.property_managers) ? wo.property_managers[0] : (wo as any).property_managers;
        const prop = (Array.isArray(wo.properties) ? wo.properties[0] : (wo as any).properties) as { name?: string } | null | undefined;
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
        const portalUrl = pm?.portal_token ? `${siteUrl}/portal?token=${encodeURIComponent(pm.portal_token)}` : undefined;
        if (pm?.email) {
          const { subject, html } = buildWorkOrderEmail({
            tenantName,
            woTitle: wo.title,
            pmName: pm.full_name ?? "there",
            action: "accepted",
            propertyName: prop?.name,
            portalUrl,
          });
          await resend.emails.send({ from: getFromAddress(tenantName), to: pm.email, subject, html })
            .catch((err) => console.error("[email] work order accepted:", err));
        }
      }

      return NextResponse.json({ success: true, jobId: job.id });
    }

    return errorResponse("Invalid action", 400);
  } catch (error) {
    logError("Work order action error", error);
    return errorResponse("Internal server error", 500);
  }
}
