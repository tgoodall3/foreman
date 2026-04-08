import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { formatDate, generateInvoiceNumber } from "@/lib/utils";
import { maybeCreateNextOccurrence } from "@/lib/recurring";
import type { SupabaseClient } from "@supabase/supabase-js";

async function autoInvoiceIfEligible(supabase: SupabaseClient, job: any) {
  if (job.invoice_id) return;
  const lineItems: any[] = job.line_items ?? [];
  if (!lineItems.length) return;

  const prop = job.properties as any;
  if (!prop?.property_manager_id) return;

  const { data: tenant } = await supabase
    .from("tenants").select("slug").eq("id", job.tenant_id).single();
  if (!tenant) return;

  const { count } = await supabase
    .from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", job.tenant_id);

  const sanitized = lineItems.map((i: any) => {
    const qty = Number(i.quantity), price = Number(i.unit_price);
    return { description: i.description, quantity: qty, unit_price: price,
      total: Math.round((qty * price + Number.EPSILON) * 100) / 100 };
  });
  const subtotal = sanitized.reduce((s: number, i: any) => s + i.total, 0);
  const due = new Date(); due.setDate(due.getDate() + 30);

  const { data: invoice } = await supabase.from("invoices").insert({
    tenant_id: job.tenant_id, job_id: job.id,
    property_manager_id: prop.property_manager_id,
    invoice_number: generateInvoiceNumber(tenant.slug, (count ?? 0) + 1),
    status: "draft", line_items: sanitized, subtotal,
    tax_rate: 0, tax_amount: 0, total: subtotal,
    due_date: due.toISOString().split("T")[0],
  }).select("id").single();

  if (invoice) {
    await supabase.from("jobs")
      .update({ invoice_id: invoice.id, status: "invoiced" }).eq("id", job.id);
  }
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { jobId } = await req.json();
  if (!jobId) return NextResponse.json({ ok: true });

  const supabase = createServiceClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("*, properties(name, address, city, state, property_manager_id), tenants(name, email)")
    .eq("id", jobId)
    .single();

  if (!job) return NextResponse.json({ ok: true });

  // Create next occurrence for recurring jobs (idempotent — checks recurrence field)
  maybeCreateNextOccurrence(supabase as any, jobId, job.tenant_id).catch(() => {});

  // Auto-create draft invoice if job has line items + property manager
  autoInvoiceIfEligible(supabase, job).catch(() => {});

  if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: true });

  const prop = job.properties as any;
  if (!prop?.property_manager_id) return NextResponse.json({ ok: true });

  const { data: pm } = await supabase
    .from("property_managers")
    .select("full_name, email")
    .eq("id", prop.property_manager_id)
    .single();

  if (!pm?.email) return NextResponse.json({ ok: true });

  const tenantName = (job.tenants as any)?.name || "Your Contractor";

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to:   pm.email,
    subject: `Work Completed: ${job.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; color: #0f1923;">
        <div style="background: #0f1923; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <span style="font-size: 22px; font-weight: 800; color: #f59e0b; letter-spacing: 1px;">FOREMAN</span>
          <p style="color: #9ca3af; font-size: 13px; margin: 4px 0 0;">${tenantName}</p>
        </div>
        <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="margin: 0 0 8px; font-size: 20px;">Work Completed ✓</h2>
          <p style="color: #6b7280; margin: 0 0 20px; font-size: 14px;">Hi ${pm.full_name}, the following work has been completed at your property.</p>

          <table style="background: #f9f8f5; border-radius: 8px; padding: 16px; width: 100%; margin-bottom: 20px; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280; width: 100px;">Job</td><td style="padding: 4px 0; font-size: 14px; font-weight: 600;">${job.title}</td></tr>
            ${prop ? `<tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280;">Property</td><td style="padding: 4px 0; font-size: 14px;">${prop.name}, ${prop.city}</td></tr>` : ""}
            <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280;">Completed</td><td style="padding: 4px 0; font-size: 14px;">${formatDate(new Date())}</td></tr>
          </table>

          ${job.description ? `<p style="font-size: 14px; color: #6b7280; margin: 0;">If you have questions, reply to this email or contact ${tenantName} directly.</p>` : ""}
        </div>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
