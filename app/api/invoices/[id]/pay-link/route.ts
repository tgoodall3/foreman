import { NextRequest } from "next/server";
import Stripe from "stripe";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { logError } from "@/lib/logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const rawEnvUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  const siteUrl = rawEnvUrl && rawEnvUrl !== "undefined" ? rawEnvUrl : req.nextUrl?.origin;

  const body = await req.json().catch(() => ({}));
  const allowACH = !!body.allowACH;
  const allowTips = !!body.allowTips;

  const rawDeposit = typeof body.amount === "number" ? body.amount : null;
  const rawTip     = typeof body.tipAmount === "number" ? body.tipAmount : 0;

  if (rawDeposit !== null && (rawDeposit <= 0 || !Number.isFinite(rawDeposit))) {
    return badRequest("Deposit amount must be a positive number.");
  }
  if (rawTip < 0 || !Number.isFinite(rawTip)) {
    return badRequest("Tip amount must be zero or a positive number.");
  }

  const depositAmount = rawDeposit;
  const tipAmount     = rawTip;

  const [{ data: invoice }, { data: tenant }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, property_managers(full_name, email), jobs(title)")
      .eq("id", params.id)
      .eq("tenant_id", profile.tenant_id)
      .single(),
    supabase
      .from("tenants")
      .select("stripe_connect_id, stripe_connect_enabled")
      .eq("id", profile.tenant_id)
      .single(),
  ]);

  if (!invoice) return badRequest("Invoice not found.");
  if (invoice.status === "paid") return badRequest("Invoice is already paid.");
  if (!tenant?.stripe_connect_id || !tenant?.stripe_connect_enabled) {
    return errorResponse("Connect your Stripe account in Settings → Billing before sending pay links.", 402);
  }

  const pm       = invoice.property_managers as any;
  const jobTitle = (invoice.jobs as any)?.title || "Services";

  const baseAmount = depositAmount && depositAmount > 0 && depositAmount <= invoice.total
    ? depositAmount
    : invoice.total;

  const tip = allowTips && tipAmount > 0 ? tipAmount : 0;
  const amountToPay = baseAmount + tip;

  try {
    // Create a one-time Stripe checkout session (not a subscription)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: allowACH ? ["card", "us_bank_account"] : ["card"],
      mode:                 "payment",
      customer_email:       pm?.email || undefined,
      line_items: [
        {
          price_data: {
            currency:     "usd",
            unit_amount:  Math.round(baseAmount * 100), // cents
            product_data: {
              name:        `Invoice ${invoice.invoice_number}`,
              description: jobTitle,
            },
          },
          quantity: 1,
        },
        ...(tip > 0 ? [{
          price_data: {
            currency: "usd",
            unit_amount: Math.round(tip * 100),
            product_data: { name: "Tip" },
          },
          quantity: 1,
        }] : []),
      ],
      success_url: `${siteUrl}/owner/invoices/${params.id}?paid=true`,
      cancel_url:  `${siteUrl}/owner/invoices/${params.id}`,
      payment_intent_data: {
        application_fee_amount: 0,
        transfer_data: { destination: tenant.stripe_connect_id! },
      },
      metadata: {
        invoice_id: params.id,
        tenant_id:  profile.tenant_id,
        deposit_amount: baseAmount,
        tip_amount: tip,
      },
    });

    // Mark as sent if still draft
    if (invoice.status === "draft") {
      await supabase
        .from("invoices")
        .update({ status: "sent" })
        .eq("id", params.id);
    }

    return jsonResponse({ url: session.url });
  } catch (err) {
    logError("Stripe pay-link failed", err);
    return errorResponse("Failed to create payment link.", 500);
  }
}
