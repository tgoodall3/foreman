import { NextRequest } from "next/server";
import { Resend } from "resend";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServerSideClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { logError } from "@/lib/logger";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function escHtml(str: string) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireOwner();
  if (!(await checkRateLimit(`email-send:${profile.id}`, 20, 60 * 60 * 1000))) {
    return errorResponse("Too many emails sent. Please wait before sending more.", 429);
  }
  if (!resend) return errorResponse("Email service not configured.", 500);
  const fromAddress = process.env.EMAIL_FROM;
  if (!fromAddress) return errorResponse("EMAIL_FROM is not set.", 500);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl?.origin;
  if (!siteUrl) return errorResponse("Site URL is not configured.", 500);

  const supabase = await createServerSideClient();
  const serviceClient = createServiceClient();

  const [{ data: co }, { data: tenantData }] = await Promise.all([
    supabase
      .from("change_orders")
      .select("*, property_managers(full_name, email), jobs(title)")
      .eq("id", id)
      .eq("tenant_id", profile.tenant_id)
      .single(),
    serviceClient.from("tenants").select("name").eq("id", profile.tenant_id).single(),
  ]);

  if (!co) return badRequest("Change order not found.");
  if (!co.property_manager_id) return badRequest("No property manager linked to this job.");
  if (co.status === "approved") return badRequest("This change order has already been approved.");

  const pm = (co as any).property_managers;
  const recipientEmail = pm?.email;
  if (!recipientEmail) return badRequest("Property manager has no email address.");

  const tenantName = escHtml(tenantData?.name || "Your Contractor");
  const pmName     = escHtml(pm?.full_name ?? "Customer");
  const jobTitle   = escHtml((co as any).jobs?.title ?? "");
  const coNumber   = escHtml(co.change_order_number);
  const total      = formatCurrency(co.total);
  const approvalUrl = `${siteUrl}/portal/change-order?token=${encodeURIComponent(co.approval_token)}`;

  const lineItems: any[] = Array.isArray(co.line_items) ? co.line_items : [];
  const lineItemsHtml = lineItems.map((item: any) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#1a1a1a;font-size:14px;">${escHtml(String(item.description ?? ""))}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#6b7280;font-size:14px;">${escHtml(String(item.quantity ?? ""))}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#6b7280;font-size:14px;">${formatCurrency(item.unit_price)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#1a1a1a;font-size:14px;">${formatCurrency(item.total)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Change Order ${coNumber}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
      <tr><td style="background:#0f1923;border-radius:12px 12px 0 0;padding:24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="background:#f59e0b;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                  <span style="font-size:18px;font-weight:900;color:#0f1923;line-height:36px;">${tenantName.charAt(0).toUpperCase()}</span>
                </td>
                <td style="padding-left:12px;">
                  <p style="margin:0;font-size:18px;font-weight:800;color:#ffffff;">${tenantName}</p>
                  <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">Change Order · ${coNumber}</p>
                </td>
              </tr></table>
            </td>
            <td align="right">
              <p style="margin:0;font-size:28px;font-weight:800;color:#f59e0b;">${total}</p>
              <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">Additional cost</p>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="background:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
        <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi ${pmName},</p>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
          Additional work has been identified${jobTitle ? ` for <strong>${jobTitle}</strong>` : ""}. Please review the change order below and approve or decline.
        </p>
        ${co.description ? `<div style="background:#f9f8f5;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;">Scope of Change</p>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${escHtml(co.description)}</p>
        </div>` : ""}
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px;">
          <thead><tr style="background:#f9fafb;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;border-bottom:2px solid #e5e7eb;">Description</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;border-bottom:2px solid #e5e7eb;width:50px;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;border-bottom:2px solid #e5e7eb;width:80px;">Unit</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;border-bottom:2px solid #e5e7eb;width:80px;">Total</th>
          </tr></thead>
          <tbody>${lineItemsHtml}</tbody>
          <tfoot><tr style="border-top:2px solid #0f1923;">
            <td colspan="3" style="padding:14px 12px;text-align:right;font-weight:700;font-size:15px;color:#374151;">Total Additional Cost</td>
            <td style="padding:14px 12px;text-align:right;font-size:24px;font-weight:800;color:#0f1923;">${total}</td>
          </tr></tfoot>
        </table>
        ${co.notes ? `<div style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 6px 6px 0;padding:12px 16px;margin-top:20px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:#d97706;">Note</p>
          <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">${escHtml(co.notes)}</p>
        </div>` : ""}
      </td></tr>
      <tr><td style="background:#0f1923;padding:28px 32px;text-align:center;">
        <a href="${approvalUrl}" style="display:inline-block;background:#f59e0b;color:#0f1923;padding:16px 40px;border-radius:10px;font-weight:800;font-size:16px;text-decoration:none;">
          Review &amp; Approve Change Order →
        </a>
      </td></tr>
      <tr><td style="background:#f9f8f5;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">Questions? Reply to this email or contact ${tenantName} directly.</p>
        <p style="margin:6px 0 0;font-size:11px;color:#d1d5db;">Powered by Foreman</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  try {
    const { error: emailError } = await resend.emails.send({
      from: `${tenantData?.name ?? "Foreman"} <${fromAddress}>`,
      to: recipientEmail,
      subject: `Change Order ${coNumber} from ${tenantData?.name ?? "Foreman"} — ${total}`,
      html,
    });
    if (emailError) {
      logError("Change order email failed", emailError);
      return errorResponse("Failed to send email.", 500);
    }

    await supabase
      .from("change_orders")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", profile.tenant_id);

    return jsonResponse({ success: true });
  } catch (err) {
    logError("Change order send error", err);
    return errorResponse("Email service error.", 500);
  }
}
