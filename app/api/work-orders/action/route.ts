import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireOwner } from "@/lib/auth";
import { validateInput, workOrderActionSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/api";
import { checkPlanForApi } from "@/lib/plan";
import { Resend } from "resend";
import { audit } from "@/lib/audit";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function escHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildWorkOrderEmail({
  tenantName,
  woTitle,
  pmName,
  action,
  propertyName,
  portalUrl,
  siteUrl,
}: {
  tenantName: string;
  woTitle: string;
  pmName: string;
  action: "accepted" | "declined";
  propertyName?: string;
  portalUrl?: string;
  siteUrl: string;
}) {
  const isAccepted = action === "accepted";
  const subject = isAccepted
    ? `Your work order was accepted — ${woTitle}`
    : `Work order update — ${woTitle}`;
  const statusColor = isAccepted ? "#16a34a" : "#dc2626";
  const statusBg    = isAccepted ? "#f0fdf4" : "#fef2f2";
  const statusBorder= isAccepted ? "#bbf7d0" : "#fecaca";
  const statusText  = isAccepted ? "Accepted" : "Declined";
  const bodyText    = isAccepted
    ? `Your work order has been reviewed and accepted. We will be in touch shortly with scheduling details.`
    : `Your work order was reviewed and unfortunately cannot be accommodated at this time. Please reply to this email if you have questions or would like to discuss alternatives.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
      <tr><td style="background:#0f1923;border-radius:12px 12px 0 0;padding:24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#f59e0b;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;font-weight:900;color:#0f1923;line-height:36px;">${escHtml(tenantName.charAt(0).toUpperCase())}</span>
                  </td>
                  <td style="padding-left:12px;">
                    <p style="margin:0;font-size:16px;font-weight:800;color:#fff;">${escHtml(tenantName)}</p>
                    <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">Work Order Update</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="background:#fff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
        <p style="margin:0 0 20px;font-size:16px;color:#374151;">Hi ${escHtml(pmName)},</p>
        <div style="background:${statusBg};border:1px solid ${statusBorder};border-radius:10px;padding:16px 20px;margin-bottom:24px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${statusColor};">Work Order ${statusText}</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:#0f1923;">${escHtml(woTitle)}</p>
          ${propertyName ? `<p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Property: ${escHtml(propertyName)}</p>` : ""}
        </div>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">${bodyText}</p>
        ${portalUrl && isAccepted ? `
        <a href="${portalUrl}" style="display:inline-block;background:#f59e0b;color:#0f1923;padding:14px 32px;border-radius:10px;font-weight:800;font-size:14px;text-decoration:none;">
          View in Portal
        </a>` : ""}
      </td></tr>
      <tr><td style="background:#f9f8f5;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">Questions? Reply to this email or visit your portal.</p>
        <p style="margin:6px 0 0;font-size:11px;color:#d1d5db;">Powered by Foreman</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
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
        .eq("tenant_id", tenantId)
        .single();

      if (!wo) return errorResponse("Work order not found", 404);

      const { error } = await supabase
        .from("work_orders")
        .update({ status: "declined" })
        .eq("id", workOrderId);

      if (error) return errorResponse("Failed to decline work order", 500);

      audit({
        tenant_id: tenantId,
        actor_id: profile.id,
        actor_name: profile.full_name,
        entity_type: "work_order",
        entity_id: workOrderId,
        entity_label: wo.title,
        action: "declined",
      });

      if (resend && process.env.EMAIL_FROM) {
        const pm = Array.isArray(wo.property_managers) ? wo.property_managers[0] : (wo as any).property_managers;
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
        if (pm?.email) {
          const { subject, html } = buildWorkOrderEmail({
            tenantName,
            woTitle: wo.title,
            pmName: pm.full_name ?? "there",
            action: "declined",
            siteUrl,
          });
          resend.emails.send({ from: process.env.EMAIL_FROM!, to: pm.email, subject, html }).catch((err) => console.error("[email] work order declined:", err));
        }
      }

      return NextResponse.json({ success: true });
    }

    if (action === "accept") {
      // Verify work order and get details
      const { data: wo } = await supabase
        .from("work_orders")
        .select("title, description, property_id, priority, property_manager_id, properties(name), property_managers(full_name, email, portal_token)")
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

      audit({
        tenant_id: tenantId,
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

      // Notify PM that work is scheduled/accepted (best-effort)
      if (resend && process.env.EMAIL_FROM) {
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
            siteUrl,
          });
          resend.emails.send({ from: process.env.EMAIL_FROM!, to: pm.email, subject, html }).catch((err) => console.error("[email] work order accepted:", err));
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
