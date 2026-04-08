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

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, property_managers(full_name, email), jobs(title)")
    .eq("id", params.id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!invoice) return badRequest("Invoice not found.");
  if (invoice.status === "paid") return badRequest("Invoice is already paid.");

  const pm       = invoice.property_managers as any;
  const jobTitle = (invoice.jobs as any)?.title || "Services";

  try {
    // Create a one-time Stripe checkout session (not a subscription)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode:                 "payment",
      customer_email:       pm?.email || undefined,
      line_items: [
        {
          price_data: {
            currency:     "usd",
            unit_amount:  Math.round(invoice.total * 100), // cents
            product_data: {
              name:        `Invoice ${invoice.invoice_number}`,
              description: jobTitle,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/owner/invoices/${params.id}?paid=true`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/owner/invoices/${params.id}`,
      metadata: {
        invoice_id: params.id,
        tenant_id:  profile.tenant_id,
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
