import { NextRequest } from "next/server";
import { Resend } from "resend";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { getOwnerInvoice } from "@/lib/services/owner";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { logError } from "@/lib/logger";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireOwner();
  if (!resend) return errorResponse("Email service not configured.", 500);
  const fromAddress = process.env.EMAIL_FROM;
  if (!fromAddress) return errorResponse("EMAIL_FROM is not set.", 500);

  let emailOverride: string | undefined;
  try {
    const body = await req.json().catch(() => null);
    emailOverride = body?.email || undefined;
  } catch {}

  const invoice = await getOwnerInvoice(profile, params.id);
  if (!invoice) return badRequest("Invoice not found.");

  const managerEmail = emailOverride || invoice.property_managers?.email;
  if (!managerEmail) return badRequest("Recipient email not provided.");

  // Fetch tenant name + PM portal token for a direct payment link
  const supabase = await createServerSideClient();
  const [{ data: tenant }, { data: pmRecord }] = await Promise.all([
    supabase.from("tenants").select("name").eq("id", profile.tenant_id).single(),
    supabase
      .from("property_managers")
      .select("portal_token")
      .eq("id", invoice.property_manager_id ?? "")
      .single(),
  ]);

  const tenantName    = tenant?.name || "Your Contractor";
  const portalToken   = (pmRecord as any)?.portal_token;
  const portalUrl     = portalToken
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/portal?token=${portalToken}&tab=invoices`
    : process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const managerName   = invoice.property_managers?.full_name ?? "Customer";
  const invoiceNumber = invoice.invoice_number;
  const total         = formatCurrency(invoice.total);
  const dueDate       = formatDate(invoice.due_date);

  // Build line items table
  const lineItems: any[] = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const lineItemsHtml = lineItems.length
    ? lineItems.map((item: any) => `
        <tr>
          <td style="padding:7px 8px;border-bottom:1px solid #f0eeea;">${item.description}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #f0eeea;text-align:right;">${item.quantity}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #f0eeea;text-align:right;">${formatCurrency(item.unit_price)}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #f0eeea;text-align:right;font-weight:600;">${formatCurrency(item.total)}</td>
        </tr>`).join("")
    : `<tr><td colspan="4" style="padding:8px;color:#9ca3af;font-size:13px;">${invoice.jobs?.title || "Services rendered"}</td></tr>`;

  const taxHtml = (invoice as any).tax_rate > 0 ? `
    <tr>
      <td colspan="3" style="padding:4px 8px;text-align:right;color:#6b7280;font-size:13px;">Subtotal</td>
      <td style="padding:4px 8px;text-align:right;color:#6b7280;font-size:13px;">${formatCurrency((invoice as any).subtotal)}</td>
    </tr>
    <tr>
      <td colspan="3" style="padding:4px 8px;text-align:right;color:#6b7280;font-size:13px;">Tax (${(invoice as any).tax_rate}%)</td>
      <td style="padding:4px 8px;text-align:right;color:#6b7280;font-size:13px;">${formatCurrency((invoice as any).tax_amount)}</td>
    </tr>` : "";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f1923;">
      <!-- Header -->
      <div style="background:#0f1923;padding:20px 24px;border-radius:8px 8px 0 0;">
        <span style="font-size:22px;font-weight:800;color:#f59e0b;letter-spacing:1px;">FOREMAN</span>
        <p style="color:#9ca3af;font-size:13px;margin:4px 0 0;">${tenantName}</p>
      </div>

      <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        <h2 style="margin:0 0 4px;font-size:20px;">Invoice ${invoiceNumber}</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Hi ${managerName}, please find your invoice below.</p>

        <!-- Summary -->
        <table style="background:#f9f8f5;border-radius:8px;padding:16px;width:100%;margin-bottom:20px;border-collapse:collapse;">
          ${invoice.jobs?.title ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;width:120px;">Job</td><td style="padding:4px 0;font-size:14px;font-weight:600;">${invoice.jobs.title}</td></tr>` : ""}
          <tr><td style="padding:4px 0;font-size:13px;color:#6b7280;">Due Date</td><td style="padding:4px 0;font-size:14px;font-weight:600;">${dueDate}</td></tr>
        </table>

        <!-- Line items -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:8px;text-align:left;font-size:11px;text-transform:uppercase;color:#9ca3af;">Description</th>
              <th style="padding:8px;text-align:right;font-size:11px;text-transform:uppercase;color:#9ca3af;">Qty</th>
              <th style="padding:8px;text-align:right;font-size:11px;text-transform:uppercase;color:#9ca3af;">Unit</th>
              <th style="padding:8px;text-align:right;font-size:11px;text-transform:uppercase;color:#9ca3af;">Total</th>
            </tr>
          </thead>
          <tbody>${lineItemsHtml}</tbody>
        </table>

        <!-- Totals -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          ${taxHtml}
          <tr style="border-top:2px solid #0f1923;">
            <td colspan="3" style="padding:10px 8px;text-align:right;font-weight:700;font-size:15px;">Total Due</td>
            <td style="padding:10px 8px;text-align:right;font-size:22px;font-weight:800;">${total}</td>
          </tr>
        </table>

        <!-- CTA -->
        <div style="text-align:center;margin:24px 0;">
          <a href="${portalUrl}" style="display:inline-block;background:#f59e0b;color:#0f1923;padding:14px 32px;border-radius:10px;font-weight:800;font-size:16px;text-decoration:none;">
            View &amp; Pay Invoice →
          </a>
          <p style="font-size:12px;color:#9ca3af;margin-top:10px;">Click above to pay securely online. ACH and card accepted.</p>
        </div>

        <p style="font-size:13px;color:#6b7280;margin-top:16px;">
          Questions? Reply to this email or contact ${tenantName} directly.
        </p>
      </div>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: `${tenantName} <${fromAddress}>`,
      to: managerEmail,
      reply_to: invoice.property_managers?.email || undefined,
      subject: `Invoice ${invoiceNumber} — ${total} due ${dueDate}`,
      html,
    });

    if (error) {
      logError("Resend email failed", error);
      return errorResponse("Failed to send email.", 500);
    }

    return jsonResponse({ success: true, emailId: data?.id });
  } catch (err) {
    logError("Email send error", err);
    return errorResponse("Email service error.", 500);
  }
}
