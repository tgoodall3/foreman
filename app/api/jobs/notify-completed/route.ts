import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase";
import { getProfile } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { getFromAddress, renderDetailCard, renderEmailLayout, renderMessageCard, renderNoticeCard } from "@/lib/email";
import { maybeCreateNextOccurrence } from "@/lib/recurring";
import { audit } from "@/lib/audit";
import { formatDate, generateInvoiceNumber } from "@/lib/utils";

async function autoInvoiceIfEligible(supabase: SupabaseClient, job: any) {
  if (job.invoice_id) return;
  const lineItems: any[] = job.line_items ?? [];
  if (!lineItems.length) return;

  const prop = job.properties as any;
  if (!prop?.property_manager_id) return;

  const { data: tenant } = await supabase.from("tenants").select("slug").eq("id", job.tenant_id).single();
  if (!tenant) return;

  const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", job.tenant_id);

  const sanitized = lineItems.map((i: any) => {
    const qty = Number(i.quantity);
    const price = Number(i.unit_price);
    return { description: i.description, quantity: qty, unit_price: price, total: Math.round((qty * price + Number.EPSILON) * 100) / 100 };
  });
  const subtotal = sanitized.reduce((s: number, i: any) => s + i.total, 0);
  const due = new Date();
  due.setDate(due.getDate() + 30);

  const { data: invoice } = await supabase
    .from("invoices")
    .insert({
      tenant_id: job.tenant_id,
      job_id: job.id,
      property_manager_id: prop.property_manager_id,
      invoice_number: generateInvoiceNumber(tenant.slug, (count ?? 0) + 1),
      status: "sent",
      line_items: sanitized,
      subtotal,
      tax_rate: 0,
      tax_amount: 0,
      total: subtotal,
      due_date: due.toISOString().split("T")[0],
    })
    .select("id")
    .single();

  if (invoice) {
    await supabase.from("jobs").update({ invoice_id: invoice.id, status: "invoiced" }).eq("id", job.id);
  }
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export async function POST(req: NextRequest) {
  const profile = await getProfile();
  if (!profile || (profile.role !== "owner" && profile.role !== "worker")) {
    return errorResponse("Unauthorized", 401);
  }

  const { jobId } = await req.json();
  if (!jobId) return NextResponse.json({ ok: true });

  const supabase = createServiceClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("*, properties(name, address, city, state, property_manager_id)")
    .eq("id", jobId)
    .single();

  if (!job) return NextResponse.json({ ok: true });
  if (job.tenant_id !== profile.tenant_id) return NextResponse.json({ ok: true });

  const { data: tenantData } = await supabase.from("tenants").select("name").eq("id", job.tenant_id).single();

  audit({
    tenant_id: job.tenant_id,
    entity_type: "job",
    entity_id: job.id,
    entity_label: job.title,
    action: "status_changed",
    metadata: { to: "completed" },
  });

  maybeCreateNextOccurrence(supabase as any, jobId, job.tenant_id).catch(() => {});
  autoInvoiceIfEligible(supabase, job).catch(() => {});

  if (!resend || !process.env.EMAIL_FROM) return NextResponse.json({ ok: true });

  const prop = job.properties as any;
  if (!prop?.property_manager_id) return NextResponse.json({ ok: true });

  const { data: pm } = await supabase
    .from("property_managers")
    .select("full_name, email, portal_token")
    .eq("id", prop.property_manager_id)
    .single();

  if (!pm?.email) return NextResponse.json({ ok: true });

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  let payUrl: string | null = null;
  if (job.invoice_id && stripe && appUrl) {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, invoice_number, total, property_manager_id")
      .eq("id", job.invoice_id)
      .single();

    if (invoice && invoice.property_manager_id === prop.property_manager_id) {
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card", "us_bank_account"],
          mode: "payment",
          customer_email: pm.email ?? undefined,
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: Math.round(invoice.total * 100),
                product_data: { name: `Invoice ${invoice.invoice_number}`, description: job.title },
              },
              quantity: 1,
            },
          ],
          success_url: `${appUrl}/portal?token=${pm.portal_token || ""}&paid=true`,
          cancel_url: `${appUrl}/portal?token=${pm.portal_token || ""}`,
          metadata: { invoice_id: invoice.id, tenant_id: job.tenant_id },
        });
        payUrl = session.url;
      } catch {
        payUrl = null;
      }
    }
  }

  const tenantName = tenantData?.name || "Foreman customer";
  const portalLink = pm.portal_token ? `${appUrl}/portal?token=${pm.portal_token}` : null;

  await resend.emails.send({
    from: getFromAddress(tenantName),
    to: pm.email,
    subject: `Work Completed: ${job.title}`,
    html: renderEmailLayout({
      tenantName,
      category: "Job Update",
      title: "Work completed",
      greeting: `Hi ${pm.full_name},`,
      intro: "The following work has been completed at your property.",
      previewText: `${job.title} has been completed.`,
      sections: [
        renderNoticeCard({
          tone: "success",
          eyebrow: "Completed",
          title: job.title,
          bodyHtml: prop?.name ? `Property: ${prop.name}${prop.city ? `, ${prop.city}` : ""}` : undefined,
        }),
        renderDetailCard("Completion details", [
          { label: "Job", value: job.title },
          { label: "Property", value: prop?.name || "" },
          { label: "Completed", value: formatDate(new Date()) },
        ]),
        job.description ? renderMessageCard("Scope of work", job.description) : "",
      ],
      primaryAction: payUrl
        ? {
            href: payUrl,
            label: "Pay invoice",
          }
        : portalLink
          ? {
              href: portalLink,
              label: "View in portal",
            }
          : undefined,
      secondaryAction: payUrl && portalLink
        ? {
            href: portalLink,
            label: "Open portal",
            variant: "secondary",
          }
        : undefined,
      footerText: `Reply to this email if you have questions for ${tenantName}.`,
    }),
  });

  return NextResponse.json({ ok: true });
}
