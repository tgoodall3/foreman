import { NextRequest } from "next/server";
import Stripe from "stripe";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { getPortalPm } from "@/lib/portal";
import { createServiceClient } from "@/lib/supabase";
import { logError } from "@/lib/logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoice_id, allowACH, allowTips, tipAmount, amount, portal_token } = body ?? {};

    // Try session auth first; fall back to portal_token for clients without accounts
    let pm = await getPortalPm();
    if (!pm && portal_token) {
      const supabaseService = createServiceClient();
      const { data: pmRaw } = await supabaseService
        .from("property_managers")
        .select("id, tenant_id, full_name, email, company, is_active")
        .eq("portal_token", portal_token)
        .single();
      if (pmRaw && pmRaw.is_active !== false) pm = pmRaw as any;
    }
    if (!pm) return errorResponse("Unauthorized", 401);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl?.origin;
    if (!siteUrl) return errorResponse("Site URL is not configured.", 500);
    if (!invoice_id) return badRequest("invoice_id is required.");

    const supabase = createServiceClient();

    // Resolve all PM IDs for this email (handles re-invites)
    let propertyManagerIds = [pm.id];
    if (pm.email) {
      const { data: aliases } = await supabase
        .from("property_managers")
        .select("id")
        .eq("tenant_id", pm.tenant_id)
        .eq("email", pm.email);
      if (aliases && aliases.length > 0) {
        propertyManagerIds = Array.from(new Set(aliases.map((a: { id: string }) => a.id)));
      }
    }

    const [{ data: invoice }, { data: tenant }] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, invoice_number, total, status, jobs(title)")
        .eq("id", invoice_id)
        .in("property_manager_id", propertyManagerIds)
        .eq("tenant_id", pm.tenant_id)
        .single(),
      supabase
        .from("tenants")
        .select("stripe_connect_id, stripe_connect_enabled")
        .eq("id", pm.tenant_id)
        .single(),
    ]);

    if (!invoice) return badRequest("Invoice not found.");
    if (invoice.status === "paid") return badRequest("Invoice is already paid.");
    if (!["sent", "overdue"].includes(invoice.status)) {
      return badRequest("Invoice is not ready for payment.");
    }
    if (!tenant?.stripe_connect_id || !tenant?.stripe_connect_enabled) {
      return errorResponse("This contractor has not connected their Stripe account yet.", 402);
    }

    const jobTitle = (invoice.jobs as any)?.title ?? "Services";
    const returnBase = `${siteUrl}/portal/invoice?invoice=${encodeURIComponent(invoice_id)}${portal_token ? `&token=${encodeURIComponent(portal_token)}` : ""}`;

    const baseAmount = typeof amount === "number" && amount > 0 && amount <= invoice.total ? amount : invoice.total;
    const tip = allowTips && typeof tipAmount === "number" && tipAmount > 0 && tipAmount <= baseAmount ? tipAmount : 0;

    const session = await stripe.checkout.sessions.create({
      ui_mode:              "embedded",
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
      return_url: `${returnBase}&paid=true`,
      payment_intent_data: {
        application_fee_amount: 0,
        transfer_data: { destination: tenant.stripe_connect_id },
      },
      metadata: {
        invoice_id: invoice.id,
        tenant_id:  pm.tenant_id,
        deposit_amount: baseAmount,
        tip_amount: tip,
      },
    });

    return jsonResponse({ clientSecret: session.client_secret });
  } catch (err) {
    logError("Portal pay error", err);
    return errorResponse("Failed to create payment link.", 500);
  }
}
