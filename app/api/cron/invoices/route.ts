import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getFromAddress, renderDetailCard, renderEmailLayout, renderNoticeCard } from "@/lib/email";

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

  if (!unpaid?.length || !resend) {
    return NextResponse.json({ marked: nowOverdue?.length ?? 0, reminded: 0 });
  }

  let reminded = 0;

  for (const inv of unpaid) {
    const pm          = inv.property_managers as any;
    const tenantName  = tenantMap[inv.tenant_id] || "Foreman customer";
    const jobTitle    = (inv.jobs as any)?.title || "Services";

    if (!pm?.email) continue;

    const dueDate     = new Date(inv.due_date + "T00:00:00Z");
    const msOverdue   = Date.now() - dueDate.getTime();
    const daysOverdue = Math.floor(msOverdue / (1000 * 60 * 60 * 24));

    // Send at exactly 3 and 7 days overdue (window: same calendar day)
    if (daysOverdue !== 3 && daysOverdue !== 7) continue;

    const isFinal = daysOverdue >= 7;
    const subject = isFinal
      ? `Final Notice: Invoice ${inv.invoice_number} is 7 days overdue`
      : `Reminder: Invoice ${inv.invoice_number} is 3 days overdue`;

    await resend!.emails.send({
      from: getFromAddress(tenantName),
      to:   pm.email,
      subject,
      html: renderEmailLayout({
        tenantName,
        category: "Invoice Reminder",
        title: isFinal ? "Final payment notice" : "Invoice payment reminder",
        greeting: `Hi ${pm.full_name ?? "there"},`,
        intro: `Invoice ${inv.invoice_number} for ${jobTitle} remains unpaid. Please arrange payment at your earliest convenience.`,
        previewText: `${isFinal ? "Final notice" : "Reminder"}: Invoice ${inv.invoice_number} is ${daysOverdue} days overdue.`,
        sections: [
          renderNoticeCard({
            tone: isFinal ? "danger" : "warning",
            eyebrow: `${daysOverdue} days overdue`,
            title: `Amount due: ${formatCurrency(inv.total)}`,
          }),
          renderDetailCard("Invoice details", [
            { label: "Invoice", value: inv.invoice_number },
            { label: "For", value: jobTitle },
            { label: "Amount", value: formatCurrency(inv.total) },
            { label: "Due date", value: formatDate(inv.due_date) },
          ]),
        ],
        footerText: `If you have questions, contact ${tenantName} directly. If payment has already been sent, please disregard this notice.`,
      }),
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
