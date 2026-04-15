import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import { requireOwner } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";
import { errorResponse } from "@/lib/api";
import { getFromAddress, renderDetailCard, renderEmailLayout, renderNoticeCard } from "@/lib/email";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const SETUP_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function POST(req: NextRequest) {
  try {
    const owner = await requireOwner();
    if (!owner) return errorResponse("Unauthorized", 401);

    const { propertyManagerId } = await req.json();
    if (!propertyManagerId) return errorResponse("propertyManagerId is required", 400);

    const supabase = createServiceClient();
    const [{ data: pm }, { data: tenant }] = await Promise.all([
      supabase
        .from("property_managers")
        .select("id, tenant_id, full_name, email, profile_id")
        .eq("id", propertyManagerId)
        .single(),
      supabase.from("tenants").select("name").eq("id", owner.tenant_id).single(),
    ]);

    if (!pm || pm.tenant_id !== owner.tenant_id) return errorResponse("Not found", 404);
    if (!pm.email) return errorResponse("PM missing email", 400);

    const tenantName = tenant?.name || "Foreman";
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    // If the PM already has an account, send a sign-in nudge instead of a setup link.
    if (pm.profile_id) {
      if (resend) {
        await resend.emails.send({
          from: getFromAddress(tenantName),
          to: pm.email,
          subject: `Access your ${tenantName} portal`,
          html: renderEmailLayout({
            tenantName,
            category: "Portal Access",
            title: "Your portal is ready",
            greeting: `Hi ${pm.full_name},`,
            intro: `${owner.full_name || tenantName} wants you to access the Foreman portal. Your account is already set up — just sign in.`,
            previewText: `Sign in to your ${tenantName} portal.`,
            sections: [
              renderNoticeCard({
                tone: "success",
                eyebrow: "Account active",
                title: "You already have a portal account",
                body: "Use your email and password to sign in. If you forgot your password, use the reset link on the sign-in page.",
              }),
              renderDetailCard("What you can do", [
                { label: "Submit", value: "Create new work orders" },
                { label: "Track", value: "Follow job and invoice updates" },
                { label: "Manage", value: "View assigned properties" },
              ]),
            ],
            primaryAction: {
              href: `${appUrl}/login?next=/portal`,
              label: "Sign in to portal",
            },
            footerText: "Reply if you need help accessing your account.",
          }),
        }).catch((err) => console.error("[email] portal login nudge:", err));
      }
      return NextResponse.json({ success: true });
    }

    // No account yet — generate a setup token and send the setup link.
    const setupToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_MS).toISOString();

    const { error: tokenError } = await supabase
      .from("property_managers")
      .update({ setup_token: setupToken, setup_token_expires_at: expiresAt })
      .eq("id", pm.id);

    if (tokenError) return errorResponse("Failed to generate setup link", 500);

    const setupLink = `${appUrl}/portal/setup?token=${setupToken}&next=/portal`;

    if (resend) {
      await resend.emails.send({
        from: getFromAddress(tenantName),
        to: pm.email,
        subject: `You're invited to the ${tenantName} portal`,
        html: renderEmailLayout({
          tenantName,
          category: "Portal Invitation",
          title: "Set up your Foreman portal account",
          greeting: `Hi ${pm.full_name},`,
          intro: `${owner.full_name || tenantName} invited you to the Foreman portal. Create your account to submit work orders, track jobs, and manage invoices.`,
          previewText: `Set up your portal account with ${tenantName}.`,
          sections: [
            renderNoticeCard({
              tone: "success",
              eyebrow: "Invitation active — expires in 7 days",
              title: "Create your account",
              body: "Click the button below to set a password and access your portal.",
            }),
            renderDetailCard("What you can do", [
              { label: "Submit", value: "Create new work orders" },
              { label: "Track", value: "Follow job and invoice updates" },
              { label: "Manage", value: "View and add assigned properties" },
            ]),
          ],
          primaryAction: {
            href: setupLink,
            label: "Set up my account",
          },
          footerText: "This link expires in 7 days. Reply if you need a new one.",
        }),
      }).catch((err) => console.error("[email] portal invite:", err));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("send-portal-link error", error);
    return errorResponse("Internal server error", 500);
  }
}
