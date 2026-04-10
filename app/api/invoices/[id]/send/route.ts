import { NextRequest } from "next/server";
import { Resend } from "resend";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { getOwnerInvoice } from "@/lib/services/owner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { logError } from "@/lib/logger";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireOwner();
  let emailOverride: string | undefined;
  try {
    const body = await req.json().catch(() => null);
    emailOverride = body?.email || undefined;
  } catch {}
  const invoice = await getOwnerInvoice(profile, params.id);

  if (!invoice) return badRequest("Invoice not found.");
  const managerEmail = emailOverride || invoice.property_managers?.email;
  if (!managerEmail) return badRequest("Recipient email not provided.");

  const managerName = invoice.property_managers?.full_name ?? "Customer";
  const invoiceNumber = invoice.invoice_number;
  const total = formatCurrency(invoice.total);
  const dueDate = formatDate(invoice.due_date);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Invoice ${invoiceNumber}</h1>
      <p>Dear ${managerName},</p>
      <p>Please find your invoice details below:</p>
      <ul>
        <li><strong>Job:</strong> ${invoice.jobs?.title || "N/A"}</li>
        <li><strong>Total:</strong> ${total}</li>
        <li><strong>Due Date:</strong> ${dueDate}</li>
      </ul>
      <p>Thank you for your business!</p>
      <p>Foreman Team</p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: "noreply@foremanapp.com", // Replace with your verified domain
      to: managerEmail,
      subject: `Invoice ${invoiceNumber} - Due ${dueDate}`,
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
