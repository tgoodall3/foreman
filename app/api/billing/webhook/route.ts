import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Idempotency — skip events already processed (Stripe retries on non-2xx)
  const { data: existing } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, skipped: true });
  }

  // Record before processing so retries during a crash don't double-process
  await supabase.from("stripe_events").insert({ id: event.id });

  switch (event.type) {
    // Checkout completed — two cases:
    //   (a) subscription checkout → upgrade tenant to pro
    //   (b) invoice payment checkout → mark foreman invoice paid
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId  = session.metadata?.tenant_id;
      const invoiceId = session.metadata?.invoice_id;

      // Case (a): subscription
      if (tenantId && session.subscription) {
        await supabase
          .from("tenants")
          .update({
            plan: "pro",
            stripe_subscription_id: session.subscription as string,
            trial_ends_at: null,
          })
          .eq("id", tenantId);
      }

      // Case (b): one-time invoice payment
      if (invoiceId && session.payment_status === "paid") {
        await supabase
          .from("invoices")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", invoiceId);

        if (process.env.RESEND_API_KEY) {
          const { data: inv } = await supabase
            .from("invoices")
            .select("invoice_number, property_managers(email, full_name), tenants(name, email)")
            .eq("id", invoiceId)
            .maybeSingle();
          const pmEmail = (inv as any)?.property_managers?.email;
          const tenantEmail = (inv as any)?.tenants?.email;
          const tenantName = (inv as any)?.tenants?.name ?? "Your contractor";
          const recipients = [pmEmail, tenantEmail].filter(Boolean);
          if (recipients.length) {
            await resend.emails.send({
              from: process.env.EMAIL_FROM!,
              to: recipients as string[],
              subject: `Payment received for invoice ${inv?.invoice_number ?? invoiceId}`,
              html: `<p style="font-family: Arial, sans-serif;">Payment received for invoice ${inv?.invoice_number ?? invoiceId}. Thank you!</p>`,
            }).catch(() => {});
          }
        }
      }
      break;
    }

    // Subscription renewed, reactivated, or plan changed
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.status === "active" || sub.status === "trialing") {
        await supabase
          .from("tenants")
          .update({ plan: "pro", stripe_subscription_id: sub.id })
          .eq("stripe_customer_id", sub.customer as string);
      }
      break;
    }

    // Subscription cancelled or expired — revert tenant to trial state
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from("tenants")
        .update({ plan: "trial", stripe_subscription_id: null })
        .eq("stripe_subscription_id", sub.id);
      break;
    }

    // Recurring payment confirmed — ensure pro flag is set (handles edge cases)
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        await supabase
          .from("tenants")
          .update({ plan: "pro" })
          .eq("stripe_subscription_id", invoice.subscription as string);
      }
      break;
    }

    // Payment failed — notify the tenant owner
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id, name, email")
          .eq("stripe_customer_id", invoice.customer as string)
          .maybeSingle();

        if (tenant) {
          const { data: owner } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("tenant_id", tenant.id)
            .eq("role", "owner")
            .single();

          const ownerEmail = owner?.email ?? tenant.email;
          if (ownerEmail) {
            const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
            await resend.emails.send({
              from: process.env.EMAIL_FROM,
              to: ownerEmail,
              subject: "Action required: Your Foreman subscription payment failed",
              html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="background:#0f1923;border-radius:12px 12px 0 0;padding:24px 32px;">
    <p style="margin:0;font-size:18px;font-weight:800;color:#fff;">Foreman</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Billing Notice</p>
  </td></tr>
  <tr><td style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;">
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;font-weight:700;color:#dc2626;">Payment failed</p>
      <p style="margin:4px 0 0;font-size:13px;color:#991b1b;">We were unable to charge your card on file.</p>
    </div>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">
      Hi ${owner?.full_name ?? "there"}, your Foreman subscription payment did not go through. Please update your payment method to keep your account active.
    </p>
    <a href="${appUrl}/owner/settings/billing" style="display:inline-block;background:#f59e0b;color:#0f1923;padding:14px 32px;border-radius:10px;font-weight:800;font-size:15px;text-decoration:none;">
      Update Payment Method →
    </a>
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">If you believe this is an error, reply to this email and we'll sort it out.</p>
  </td></tr>
  <tr><td style="background:#f9f8f5;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#d1d5db;">Powered by Foreman</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`,
            }).catch(() => {});
          }
        }
      }
      break;
    }

    // Stripe Connect — mark account as enabled once onboarding is complete
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      if (account.charges_enabled && account.details_submitted) {
        await supabase
          .from("tenants")
          .update({ stripe_connect_enabled: true })
          .eq("stripe_connect_id", account.id);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
