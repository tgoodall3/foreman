import { NextRequest } from "next/server";
import { Resend } from "resend";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { logError } from "@/lib/logger";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: estimate } = await supabase
    .from("estimates")
    .select("*, property_managers(full_name, email), properties(name, address, city, state), tenants(name)")
    .eq("id", params.id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!estimate) return badRequest("Estimate not found.");
  if (estimate.status === "converted") return badRequest("Estimate has already been converted to a job.");

  const pm = estimate.property_managers as any;
  if (!pm?.email) return badRequest("Property manager email not available.");

  const tenantName = (estimate.tenants as any)?.name || "Your Contractor";
  const approvalUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/portal/estimate?token=${estimate.approval_token}`;
  const prop       = estimate.properties as any;

  const lineItemsHtml = (estimate.line_items as any[])
    .map(
      (item) =>
        `<tr>
          <td style="padding:6px 8px; border-bottom:1px solid #f0eeea;">${item.description}</td>
          <td style="padding:6px 8px; border-bottom:1px solid #f0eeea; text-align:right;">${item.quantity}</td>
          <td style="padding:6px 8px; border-bottom:1px solid #f0eeea; text-align:right;">${formatCurrency(item.unit_price)}</td>
          <td style="padding:6px 8px; border-bottom:1px solid #f0eeea; text-align:right; font-weight:600;">${formatCurrency(item.total)}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #0f1923;">
      <div style="background: #0f1923; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <span style="font-size: 22px; font-weight: 800; color: #f59e0b; letter-spacing: 1px;">FOREMAN</span>
        <p style="color: #9ca3af; font-size: 13px; margin: 4px 0 0;">${tenantName}</p>
      </div>

      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="margin: 0 0 4px; font-size: 20px;">Estimate ${estimate.estimate_number}</h2>
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 20px;">Hi ${pm.full_name}, please review the estimate below.</p>

        <table style="background: #f9f8f5; border-radius: 8px; padding: 16px; width: 100%; margin-bottom: 20px; border-collapse: collapse;">
          <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280; width: 120px;">Project</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600;">${estimate.title}</td></tr>
          ${prop ? `<tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280;">Property</td><td style="padding: 4px 0; font-size: 14px;">${prop.name}, ${prop.city}</td></tr>` : ""}
          ${estimate.valid_until ? `<tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280;">Valid Until</td><td style="padding: 4px 0; font-size: 14px;">${formatDate(estimate.valid_until)}</td></tr>` : ""}
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 14px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #9ca3af;">Description</th>
              <th style="padding: 8px; text-align: right; font-size: 11px; text-transform: uppercase; color: #9ca3af;">Qty</th>
              <th style="padding: 8px; text-align: right; font-size: 11px; text-transform: uppercase; color: #9ca3af;">Unit Price</th>
              <th style="padding: 8px; text-align: right; font-size: 11px; text-transform: uppercase; color: #9ca3af;">Total</th>
            </tr>
          </thead>
          <tbody>${lineItemsHtml}</tbody>
        </table>

        <div style="text-align: right; border-top: 2px solid #0f1923; padding-top: 12px;">
          ${estimate.tax_rate > 0 ? `
            <p style="margin: 4px 0; font-size: 14px; color: #6b7280;">Subtotal: ${formatCurrency(estimate.subtotal)}</p>
            <p style="margin: 4px 0; font-size: 14px; color: #6b7280;">Tax (${estimate.tax_rate}%): ${formatCurrency(estimate.tax_amount)}</p>
          ` : ""}
          <p style="margin: 8px 0 0; font-size: 20px; font-weight: 800; color: #0f1923;">Total: ${formatCurrency(estimate.total)}</p>
        </div>

        ${estimate.notes ? `<div style="margin-top: 20px; background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; font-size: 14px;">${estimate.notes}</div>` : ""}

        <div style="margin-top: 20px; display: flex; gap: 10px;">
          <a href="${approvalUrl}&status=approved" style="background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;font-weight:700;text-decoration:none;font-size:14px;">Approve</a>
          <a href="${approvalUrl}&status=declined" style="border:1px solid #d1d5db;color:#0f1923;padding:10px 16px;border-radius:8px;font-weight:700;text-decoration:none;font-size:14px;">Decline</a>
        </div>
        <p style="font-size: 13px; color: #9ca3af; margin-top: 12px;">Or view this estimate in your portal.</p>
      </div>
    </div>
  `;

  try {
    const { error: emailError } = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to:   pm.email,
      subject: `Estimate ${estimate.estimate_number} from ${tenantName} — ${formatCurrency(estimate.total)}`,
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

  // Mark as sent
  await supabase
    .from("estimates")
    .update({ status: "sent" })
    .eq("id", params.id);

  return jsonResponse({ success: true });
}
