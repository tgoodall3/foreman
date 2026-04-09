import { NextRequest } from "next/server";
import Stripe from "stripe";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase";
import { logError } from "@/lib/logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoice_id, token, allowACH, allowTips, tipAmount, amount } = body ?? {};

    if (!invoice_id || !token) return badRequest("invoice_id and token are required.");

    const supabase = createServiceClient();

    // Verify token → find the PM
    const { data: pm } = await supabase
      .from("property_managers")
      .select("id, tenant_id, full_name, email")
      .eq("portal_token", token)
      .single();

    if (!pm) return errorResponse("Invalid portal token.", 403);

    // Load invoice and confirm it belongs to this PM
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, invoice_number, total, status, jobs(title)")
      .eq("id", invoice_id)
      .eq("property_manager_id", pm.id)
      .eq("tenant_id", pm.tenant_id)
      .single();

    if (!invoice) return badRequest("Invoice not found.");
    if (invoice.status === "paid") return badRequest("Invoice is already paid.");
    if (!["sent", "overdue"].includes(invoice.status)) {
      return badRequest("Invoice is not ready for payment.");
    }

    const jobTitle = (invoice.jobs as any)?.title ?? "Services";
    const returnBase = `${process.env.NEXT_PUBLIC_APP_URL}/portal?token=${encodeURIComponent(token)}&tab=invoices`;

    const baseAmount = typeof amount === "number" && amount > 0 && amount <= invoice.total ? amount : invoice.total;
    const tip = allowTips && typeof tipAmount === "number" && tipAmount > 0 ? tipAmount : 0;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: allowACH ? ["card", "us_bank_account"] : ["card"],
      mode:                 "payment",
      customer_email:       pm.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency:     "usd",
            unit_amount:  Math.round(baseAmount * 100),
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
      success_url: `${returnBase}&paid=true`,
      cancel_url:  returnBase,
      metadata: {
        invoice_id: invoice.id,
        tenant_id:  pm.tenant_id,
        deposit_amount: baseAmount,
        tip_amount: tip,
      },
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    logError("Portal pay error", err);
    return errorResponse("Failed to create payment link.", 500);
  }
}
