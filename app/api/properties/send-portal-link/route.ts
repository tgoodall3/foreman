import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireOwner } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";
import { errorResponse } from "@/lib/api";
import { renderDetailCard, renderEmailLayout, renderNoticeCard } from "@/lib/email";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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
        .select("id, tenant_id, full_name, email, portal_token")
        .eq("id", propertyManagerId)
        .single(),
      supabase.from("tenants").select("name").eq("id", owner.tenant_id).single(),
    ]);

    if (!pm || pm.tenant_id !== owner.tenant_id) return errorResponse("Not found", 404);
    if (!pm.email) return errorResponse("PM missing email", 400);
    if (!pm.portal_token) return errorResponse("PM missing portal token", 400);

    const tenantName = tenant?.name || "Foreman";
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const portalLink = `${appUrl}/portal?token=${pm.portal_token}`;

    if (resend && process.env.EMAIL_FROM) {
      await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: pm.email,
        subject: "Your contractor invited you to Foreman portal",
        html: renderEmailLayout({
          tenantName,
          category: "Portal Invitation",
          title: "Your Foreman portal is ready",
          greeting: `Hi ${pm.full_name},`,
          intro: `${owner.full_name || tenantName} invited you to the Foreman portal to submit work orders, manage properties, and track updates.`,
          previewText: `Open your portal to manage work orders with ${tenantName}.`,
          sections: [
            renderNoticeCard({
              tone: "success",
              eyebrow: "Invitation active",
              title: "Access your portal anytime",
              body: "Use the secure link below to open your portal dashboard.",
            }),
            renderDetailCard("What you can do", [
              { label: "Submit", value: "Create new work orders" },
              { label: "Track", value: "Follow job and invoice updates" },
              { label: "Manage", value: "View and add assigned properties" },
            ]),
          ],
          primaryAction: {
            href: portalLink,
            label: "Open portal",
          },
          footerText: "Bookmark your portal link for quick access. Reply if you need help signing in.",
        }),
      }).catch((err) => console.error("[email] portal link:", err));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("send-portal-link error", error);
    return errorResponse("Internal server error", 500);
  }
}
