import { NextRequest } from "next/server";
import Stripe from "stripe";
import { requireOwner } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";
import { errorResponse, jsonResponse } from "@/lib/api";
import { logError } from "@/lib/logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const profile = await requireOwner();
    const supabase = createServiceClient();

    const rawEnvUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
    const siteUrl = rawEnvUrl && rawEnvUrl !== "undefined" ? rawEnvUrl : req.nextUrl?.origin;
    if (!siteUrl) return errorResponse("Site URL is not configured.", 500);

    const { data: tenant } = await supabase
      .from("tenants")
      .select("stripe_connect_id, stripe_connect_enabled, name, email")
      .eq("id", profile.tenant_id)
      .single();

    if (!tenant) return errorResponse("Tenant not found.", 404);

    // If already connected and enabled, return portal link instead
    if (tenant.stripe_connect_id && tenant.stripe_connect_enabled) {
      const loginLink = await stripe.accounts.createLoginLink(tenant.stripe_connect_id);
      return jsonResponse({ url: loginLink.url, existing: true });
    }

    // Create or reuse a Stripe Express account
    let accountId = tenant.stripe_connect_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: tenant.email,
        business_profile: { name: tenant.name ?? undefined },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;
      await supabase
        .from("tenants")
        .update({ stripe_connect_id: accountId })
        .eq("id", profile.tenant_id);
    }

    // Generate an onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl}/api/billing/connect/refresh`,
      return_url: `${siteUrl}/owner/settings/billing?connect=success`,
      type: "account_onboarding",
    });

    return jsonResponse({ url: accountLink.url });
  } catch (err) {
    logError("Stripe Connect onboarding error", err);
    return errorResponse("Failed to start Stripe Connect onboarding.", 500);
  }
}

// Called to refresh Connect status after returning from Stripe onboarding
export async function PATCH(req: NextRequest) {
  try {
    const profile = await requireOwner();
    const supabase = createServiceClient();

    const { data: tenant } = await supabase
      .from("tenants")
      .select("stripe_connect_id")
      .eq("id", profile.tenant_id)
      .single();

    if (!tenant?.stripe_connect_id) return errorResponse("No Stripe Connect account linked.", 404);

    const account = await stripe.accounts.retrieve(tenant.stripe_connect_id);
    const enabled =
      account.charges_enabled &&
      account.payouts_enabled &&
      account.details_submitted;

    await supabase
      .from("tenants")
      .update({ stripe_connect_enabled: enabled })
      .eq("id", profile.tenant_id);

    return jsonResponse({ enabled });
  } catch (err) {
    logError("Stripe Connect status update error", err);
    return errorResponse("Failed to update Connect status.", 500);
  }
}
