import { NextRequest } from "next/server";
import { Resend } from "resend";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { getOwnerInvoice } from "@/lib/services/owner";
import { createServerSideClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import { logError } from "@/lib/logger";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Basic email validation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Escape HTML entities to prevent XSS in email bodies
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

  // Prefer explicit site URL; fall back to app URL or the incoming host to avoid "undefined" links in emails
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

  const invoice = await getOwnerInvoice(profile, params.id);
  if (!invoice) return badRequest("Invoice not found.");

  const managerEmail = emailOverride || invoice.property_managers?.email;
  if (!managerEmail) return badRequest("Recipient email not provided.");

  const supabase = await createServerSideClient();
  const serviceClient = createServiceClient();
  const tenantId = profile.tenant_id;

  const [{ data: pmRecord }, { data: tenant }] = await Promise.all([
    supabase
      .from("property_managers")
      .select("portal_token")
      .eq("id", invoice.property_manager_id ?? "")
      .single(),
    serviceClient
      .from("tenants")
      .select("name, invoice_footer, email, website")
      .eq("id", tenantId)
      .single(),
  ]);

  console.log("[invoice/send] tenantId:", tenantId, "tenant:", tenant);
  const tenantName    = escHtml(tenant?.name || "Foreman customer");
  const invoiceFooter = tenant?.invoice_footer ? escHtml(tenant.invoice_footer) : null;
  const portalToken   = (pmRecord as any)?.portal_token;

  // Link directly to the dedicated invoice page so the client can sign and pay
  const invoicePageUrl = portalToken
    ? `${siteUrl}/portal/invoice?token=${encodeURIComponent(portalToken)}&invoice=${encodeURIComponent(params.id)}`
    : null;

  if (!invoicePageUrl) {
    return errorResponse("This property manager does not have a portal link yet. Send them a portal invite first.", 400);
  }

  const managerName   = escHtml(invoice.property_managers?.full_name ?? "Customer");
  const invoiceNumber = escHtml(invoice.invoice_number);
  const total         = formatCurrency(invoice.total);
  const dueDate       = formatDate(invoice.due_date);

  const lineItems: any[] = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const lineItemsHtml = lineItems.length
    ? lineItems.map((item: any) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#1a1a1a;font-size:14px;">${escHtml(String(item.description ?? ""))}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#6b7280;font-size:14px;">${escHtml(String(item.quantity ?? ""))}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#6b7280;font-size:14px;">${formatCurrency(item.unit_price)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#1a1a1a;font-size:14px;">${formatCurrency(item.total)}</td>
        </tr>`).join("")
    : `<tr><td colspan="4" style="padding:12px;color:#9ca3af;font-size:13px;text-align:center;">${escHtml(invoice.jobs?.title || "Services rendered")}</td></tr>`;

  const taxHtml = (invoice as any).tax_rate > 0 ? `
    <tr>
      <td colspan="3" style="padding:6px 12px;text-align:right;color:#6b7280;font-size:13px;">Subtotal</td>
      <td style="padding:6px 12px;text-align:right;color:#6b7280;font-size:13px;">${formatCurrency((invoice as any).subtotal)}</td>
    </tr>
    <tr>
      <td colspan="3" style="padding:6px 12px;text-align:right;color:#6b7280;font-size:13px;">Tax (${escHtml(String((invoice as any).tax_rate))}%)</td>
      <td style="padding:6px 12px;text-align:right;color:#6b7280;font-size:13px;">${formatCurrency((invoice as any).tax_amount)}</td>
    </tr>` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ${invoiceNumber}</title></head>
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
                    <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">Invoice · ${invoiceNumber}</p>
                  </td>
                </tr>
              </table>
            </td>
            <td align="right" style="vertical-align:top;">
              <p style="margin:0;font-size:28px;font-weight:800;color:#f59e0b;">${total}</p>
              <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">Due ${dueDate}</p>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
        <p style="margin:0 0 24px;font-size:16px;color:#374151;">Hi ${managerName},</p>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
          Please find your invoice from ${tenantName} below. You can review the details and pay securely online using the button at the bottom.
        </p>

        ${invoice.jobs?.title ? `
        <!-- Job summary -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f8f5;border-radius:10px;margin-bottom:24px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;">Job</p>
              <p style="margin:0;font-size:15px;font-weight:600;color:#0f1923;">${escHtml(invoice.jobs.title)}</p>
            </td>
          </tr>
        </table>` : ""}

        <!-- Line items -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px;">
          <thead>
            <tr style="background:#f9fafb;border-radius:6px;">
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
              <td colspan="3" style="padding:14px 12px;text-align:right;font-weight:700;font-size:15px;color:#374151;">Total Due</td>
              <td style="padding:14px 12px;text-align:right;font-size:24px;font-weight:800;color:#0f1923;">${total}</td>
            </tr>
          </tfoot>
        </table>

        ${invoice.notes ? `
        <!-- Notes -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
          <tr>
            <td style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 6px 6px 0;padding:12px 16px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#d97706;">Note</p>
              <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">${escHtml(invoice.notes)}</p>
            </td>
          </tr>
        </table>` : ""}

      </td></tr>

      <!-- CTA -->
      <tr><td style="background:#0f1923;padding:28px 32px;text-align:center;">
        <a href="${invoicePageUrl}"
           style="display:inline-block;background:#f59e0b;color:#0f1923;padding:16px 40px;border-radius:10px;font-weight:800;font-size:16px;text-decoration:none;letter-spacing:0.02em;">
          Review &amp; Pay Invoice →
        </a>
        <p style="margin:14px 0 0;font-size:12px;color:#6b7280;">
          Secure payment powered by Stripe · Card and ACH accepted
        </p>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f9f8f5;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
        ${invoiceFooter ? `<p style="margin:0 0 8px;font-size:12px;color:#6b7280;">${invoiceFooter}</p>` : ""}
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
    const tenantNameRaw = tenant?.name ?? "Foreman";
    const { data, error } = await resend.emails.send({
      from: `${tenantNameRaw} <${fromAddress}>`,
      to: managerEmail,
      reply_to: invoice.property_managers?.email || undefined,
      subject: `Invoice ${invoiceNumber} from ${tenantNameRaw} — ${total} due ${dueDate}`,
      html,
    });

    if (error) {
      logError("Resend invoice email failed", error);
      return errorResponse("Failed to send email.", 500);
    }

    // Mark invoice as sent now that the email is confirmed delivered
    if (invoice.status === "draft") {
      await supabase
        .from("invoices")
        .update({ status: "sent" })
        .eq("id", params.id);
    }

    return jsonResponse({ success: true, emailId: data?.id });
  } catch (err) {
    logError("Invoice email send error", err);
    return errorResponse("Email service error.", 500);
  }
}
