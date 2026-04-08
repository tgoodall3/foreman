import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
    // Checkout completed — subscription created, upgrade tenant to pro
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenant_id;
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

    // Payment failed — TODO: send dunning email via Resend
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn(`Payment failed for customer ${invoice.customer}`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
