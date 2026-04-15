import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { audit } from "@/lib/audit";
import { getFromAddress, renderDetailCard, renderEmailLayout, renderNoticeCard } from "@/lib/email";

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

        if (tenantId) {
          audit({
            tenant_id: tenantId,
            entity_type: "invoice",
            entity_id: invoiceId,
            action: "paid",
            metadata: { session_id: session.id },
          });
        }

        if (process.env.RESEND_API_KEY) {
          const [{ data: inv }, { data: tenantRow }] = await Promise.all([
            supabase
              .from("invoices")
              .select("invoice_number, property_managers(email, full_name)")
              .eq("id", invoiceId)
              .maybeSingle(),
            tenantId
              ? supabase.from("tenants").select("name, email").eq("id", tenantId).single()
              : Promise.resolve({ data: null }),
          ]);
          const pmEmail = (inv as any)?.property_managers?.email;
          const tenantEmail = (tenantRow as any)?.email;
          const tenantName = (tenantRow as any)?.name ?? "Your contractor";
          const recipients = [pmEmail, tenantEmail].filter(Boolean);
          if (recipients.length) {
            await resend.emails.send({
              from: getFromAddress(tenantName),
              to: recipients as string[],
              subject: `Payment received for invoice ${inv?.invoice_number ?? invoiceId}`,
              html: renderEmailLayout({
                tenantName,
                category: "Billing Update",
                title: "Payment received",
                intro: "Your invoice payment was received successfully.",
                previewText: `Payment received for invoice ${inv?.invoice_number ?? invoiceId}.`,
                sections: [
                  renderNoticeCard({
                    tone: "success",
                    eyebrow: "Paid",
                    title: `Invoice ${inv?.invoice_number ?? invoiceId}`,
                    body: "Thank you. No further action is needed.",
                  }),
                  renderDetailCard("Receipt details", [
                    { label: "Invoice", value: inv?.invoice_number ?? invoiceId },
                    { label: "Status", value: "Paid" },
                  ]),
                ],
                footerText: "Keep this email for your records or reply if you need a copy of the receipt.",
              }),
            }).catch((err) => console.error("[email] invoice paid notification:", err));
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
              from: getFromAddress(),
              to: ownerEmail,
              subject: "Action required: Your Foreman subscription payment failed",
              html: renderEmailLayout({
                tenantName: "Foreman",
                category: "Billing Notice",
                title: "Subscription payment failed",
                greeting: `Hi ${owner?.full_name ?? "there"},`,
                intro: "Your Foreman subscription payment did not go through. Please update your payment method to keep your account active.",
                sections: [
                  renderNoticeCard({
                    tone: "danger",
                    eyebrow: "Action required",
                    title: "We were unable to charge your card on file",
                    body: "Update your payment method before your next billing cycle to avoid service interruption.",
                  }),
                ],
                primaryAction: {
                  href: `${appUrl}/owner/settings/billing`,
                  label: "Update Payment Method",
                },
                footerText: "If you believe this is an error, reply to this email and we'll sort it out.",
              }),
            }).catch((err) => console.error("[email] payment failed notification:", err));
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
