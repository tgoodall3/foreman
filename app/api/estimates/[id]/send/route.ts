import { NextRequest } from "next/server";
import { Resend } from "resend";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import { logError } from "@/lib/logger";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireOwner();
  if (!resend) return errorResponse("Email service not configured.", 500);
  const fromAddress = process.env.EMAIL_FROM;
  if (!fromAddress) return errorResponse("EMAIL_FROM is not set.", 500);

  // Build the site base URL defensively so outbound links never render as "undefined"
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl?.origin;
  if (!siteUrl) return errorResponse("Site URL is not configured.", 500);

  let emailOverride: string | undefined;
  try {
    const body = await req.json().catch(() => null);
    const raw = body?.email;
    if (raw) {
      if (typeof raw !== "string" || !EMAIL_RE.test(raw)) {
        return badRequest("Invalid email address provided.");
      }
      emailOverride = raw;
    }
  } catch {}

  const supabase = await createServerSideClient();
  const serviceClient = createServiceClient();

  const [{ data: estimate }, { data: tenantData }] = await Promise.all([
    supabase
      .from("estimates")
      .select("*, property_managers(full_name, email), properties(name, address, city, state)")
      .eq("id", params.id)
      .eq("tenant_id", profile.tenant_id)
      .single(),
    serviceClient.from("tenants").select("name").eq("id", profile.tenant_id).single(),
  ]);

  if (!estimate) return badRequest("Estimate not found.");
  if (estimate.status === "converted") return badRequest("Estimate has already been converted to a job.");

  const pm       = estimate.property_managers as any;
  const toEmail  = emailOverride || pm?.email;
  if (!toEmail) return badRequest("Property manager email not available.");

  const tenantName  = escHtml(tenantData?.name || "Foreman customer");
  const pmName      = escHtml(pm?.full_name ?? "Customer");
  const prop        = estimate.properties as any;
  const reviewUrl   = `${siteUrl}/portal/estimate?token=${encodeURIComponent(estimate.approval_token)}`;
  const total       = formatCurrency(estimate.total);

  const lineItemsHtml = (estimate.line_items as any[])
    .map((item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#1a1a1a;font-size:14px;">${escHtml(String(item.description ?? ""))}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#6b7280;font-size:14px;">${escHtml(String(item.quantity ?? ""))}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#6b7280;font-size:14px;">${formatCurrency(item.unit_price)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#1a1a1a;font-size:14px;">${formatCurrency(item.total)}</td>
      </tr>`
    )
    .join("");

  const taxHtml = estimate.tax_rate > 0 ? `
    <tr>
      <td colspan="3" style="padding:6px 12px;text-align:right;color:#6b7280;font-size:13px;">Subtotal</td>
      <td style="padding:6px 12px;text-align:right;color:#6b7280;font-size:13px;">${formatCurrency(estimate.subtotal)}</td>
    </tr>
    <tr>
      <td colspan="3" style="padding:6px 12px;text-align:right;color:#6b7280;font-size:13px;">Tax (${escHtml(String(estimate.tax_rate))}%)</td>
      <td style="padding:6px 12px;text-align:right;color:#6b7280;font-size:13px;">${formatCurrency(estimate.tax_amount)}</td>
    </tr>` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Estimate ${escHtml(estimate.estimate_number)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

      <!-- Header -->
      <tr><td style="background:#0f1923;border-radius:12px 12px 0 0;padding:24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#f59e0b;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="font-size:18px;font-weight:900;color:#0f1923;line-height:36px;">${tenantName.charAt(0).toUpperCase()}</span>
                  </td>
                  <td style="padding-left:12px;">
                    <p style="margin:0;font-size:18px;font-weight:800;color:#ffffff;letter-spacing:0.05em;">${tenantName}</p>
                    <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">Estimate · ${escHtml(estimate.estimate_number)}</p>
                  </td>
                </tr>
              </table>
            </td>
            <td align="right" style="vertical-align:top;">
              <p style="margin:0;font-size:28px;font-weight:800;color:#f59e0b;">${total}</p>
              ${estimate.valid_until ? `<p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">Valid until ${escHtml(formatDate(estimate.valid_until))}</p>` : ""}
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
        <p style="margin:0 0 8px;font-size:16px;color:#374151;">Hi ${pmName},</p>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
          ${tenantName} has prepared an estimate for the following work. Please review the details and sign to approve.
        </p>

        <!-- Project summary -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f8f5;border-radius:10px;margin-bottom:24px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;">Project</p>
              <p style="margin:0 0 ${prop ? "10px" : "0"};font-size:15px;font-weight:700;color:#0f1923;">${escHtml(estimate.title)}</p>
              ${prop ? `<p style="margin:0;font-size:13px;color:#6b7280;">${escHtml(prop.name)} · ${escHtml(prop.address)}, ${escHtml(prop.city)}, ${escHtml(prop.state)}</p>` : ""}
            </td>
          </tr>
        </table>

        <!-- Description -->
        ${estimate.description ? `
        <div style="margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">Scope of Work</p>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${escHtml(estimate.description)}</p>
        </div>` : ""}

        <!-- Line items -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;border-bottom:2px solid #e5e7eb;">Description</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;border-bottom:2px solid #e5e7eb;width:50px;">Qty</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;border-bottom:2px solid #e5e7eb;width:80px;">Unit</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;border-bottom:2px solid #e5e7eb;width:80px;">Total</th>
            </tr>
          </thead>
          <tbody>${lineItemsHtml}</tbody>
          <tfoot>
            ${taxHtml}
            <tr style="border-top:2px solid #0f1923;">
              <td colspan="3" style="padding:14px 12px;text-align:right;font-weight:700;font-size:15px;color:#374151;">Estimate Total</td>
              <td style="padding:14px 12px;text-align:right;font-size:24px;font-weight:800;color:#0f1923;">${total}</td>
            </tr>
          </tfoot>
        </table>

        ${estimate.notes ? `
        <!-- Notes -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
          <tr>
            <td style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 6px 6px 0;padding:12px 16px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#d97706;">Note from ${tenantName}</p>
              <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">${escHtml(estimate.notes)}</p>
            </td>
          </tr>
        </table>` : ""}

        <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.5;">
          To approve this estimate, click the button below. You will be asked to sign digitally before approval is submitted.
          If you have questions, reply to this email.
        </p>
      </td></tr>

      <!-- CTA -->
      <tr><td style="background:#0f1923;padding:28px 32px;text-align:center;">
        <a href="${reviewUrl}"
           style="display:inline-block;background:#f59e0b;color:#0f1923;padding:16px 40px;border-radius:10px;font-weight:800;font-size:16px;text-decoration:none;letter-spacing:0.02em;">
          Review &amp; Sign Estimate →
        </a>
        <p style="margin:14px 0 0;font-size:12px;color:#6b7280;">
          Your digital signature will be recorded upon approval.
        </p>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f9f8f5;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">
          Questions? Reply to this email or contact ${tenantName} directly.
        </p>
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
      to:   toEmail,
      reply_to: pm?.email || undefined,
      subject: `Estimate ${escHtml(estimate.estimate_number)} from ${tenantData?.name ?? "your contractor"} — ${total}`,
      html,
    });

    if (emailError) {
      logError("Estimate send email failed", emailError);
      return errorResponse("Failed to send email.", 500);
    }
  } catch (err) {
    logError("Estimate send error", err);
    return errorResponse("Email service error.", 500);
  }

  await supabase
    .from("estimates")
    .update({ status: "sent" })
    .eq("id", params.id);

  return jsonResponse({ success: true });
}
