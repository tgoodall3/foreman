import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { formatCurrency, formatDate } from "@/lib/utils";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/** Vercel calls this daily at 09:00 UTC. */
export async function GET(req: NextRequest) {
  // Protect: only Vercel cron or a request with the correct secret may call this
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today    = new Date().toISOString().split("T")[0];

  // 1. Mark sent invoices past their due date as overdue
  const { data: nowOverdue } = await supabase
    .from("invoices")
    .update({ status: "overdue" })
    .eq("status", "sent")
    .lt("due_date", today)
    .select("id");

  // 2. Fetch all unpaid (sent + overdue) invoices with PM contact info
  const { data: unpaid } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, due_date, status, tenant_id, property_managers(full_name, email), jobs(title)")
    .in("status", ["sent", "overdue"]);

  // Fetch tenant names in one query for all unique tenant IDs
  const tenantIds = Array.from(new Set((unpaid ?? []).map((inv) => inv.tenant_id).filter(Boolean)));
  const tenantMap: Record<string, string> = {};
  if (tenantIds.length) {
    const { data: tenants } = await supabase.from("tenants").select("id, name").in("id", tenantIds);
    for (const t of tenants ?? []) tenantMap[t.id] = t.name;
  }

  if (!unpaid?.length || !resend || !process.env.EMAIL_FROM) {
    return NextResponse.json({ marked: nowOverdue?.length ?? 0, reminded: 0 });
  }

  let reminded = 0;

  for (const inv of unpaid) {
    const pm         = inv.property_managers as any;
    const tenantName = tenantMap[inv.tenant_id] || "Your Contractor";
    const jobTitle   = (inv.jobs as any)?.title || "Services";

    if (!pm?.email) continue;

    const dueDate    = new Date(inv.due_date + "T00:00:00Z");
    const msOverdue  = Date.now() - dueDate.getTime();
    const daysOverdue = Math.floor(msOverdue / (1000 * 60 * 60 * 24));

    // Send at exactly 3 and 7 days overdue (window: same calendar day)
    if (daysOverdue !== 3 && daysOverdue !== 7) continue;

    const subject = daysOverdue === 3
      ? `Reminder: Invoice ${inv.invoice_number} is 3 days overdue`
      : `Final Notice: Invoice ${inv.invoice_number} is 7 days overdue`;

    const urgencyColor = daysOverdue >= 7 ? "#dc2626" : "#f59e0b";

    await resend!.emails.send({
      from: process.env.EMAIL_FROM!,
      to:   pm.email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; color: #0f1923;">
          <div style="background: #0f1923; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <span style="font-size: 22px; font-weight: 800; color: #f59e0b; letter-spacing: 1px;">FOREMAN</span>
            <p style="color: #9ca3af; font-size: 13px; margin: 4px 0 0;">${tenantName}</p>
          </div>
          <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <div style="background: ${urgencyColor}15; border-left: 4px solid ${urgencyColor}; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
              <p style="margin: 0; font-weight: 700; color: ${urgencyColor}; font-size: 15px;">
                Payment ${daysOverdue} day${(daysOverdue as number) !== 1 ? "s" : ""} overdue
              </p>
            </div>

            <p style="margin: 0 0 16px; font-size: 14px;">Hi ${pm.full_name},</p>
            <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280;">
              Invoice <strong>${inv.invoice_number}</strong> for <strong>${jobTitle}</strong> remains unpaid.
              Please arrange payment at your earliest convenience.
            </p>

            <table style="background: #f9f8f5; border-radius: 8px; padding: 16px; width: 100%; margin-bottom: 20px; border-collapse: collapse;">
              <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280; width: 120px;">Invoice</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600;">${inv.invoice_number}</td></tr>
              <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280;">Amount Due</td><td style="padding: 4px 0; font-size: 18px; font-weight: 800; color: ${urgencyColor};">${formatCurrency(inv.total)}</td></tr>
              <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280;">Due Date</td><td style="padding: 4px 0; font-size: 14px;">${formatDate(inv.due_date)}</td></tr>
            </table>

            <p style="font-size: 13px; color: #9ca3af;">
              If you have questions, contact ${tenantName} directly.
              If payment has already been sent, please disregard this notice.
            </p>
          </div>
        </div>
      `,
    });

    reminded++;
  }

  return NextResponse.json({
    ok:       true,
    marked:   nowOverdue?.length ?? 0,
    reminded,
    date:     today,
  });
}
