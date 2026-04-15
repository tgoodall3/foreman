import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { getFromAddress, renderDetailCard, renderEmailLayout, renderNoticeCard } from "@/lib/email";

/**
 * GET /api/cron/estimates
 * Runs daily. Sends expiry warning emails to owners for estimates
 * expiring in 3 days or 1 day. Also marks estimates as expired if past valid_until.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const supabase = createServiceClient();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Warn for estimates expiring in exactly 3 or 1 days
  const warn3 = new Date(today); warn3.setDate(warn3.getDate() + 3);
  const warn1 = new Date(today); warn1.setDate(warn1.getDate() + 1);
  const warn3Str = warn3.toISOString().split("T")[0];
  const warn1Str = warn1.toISOString().split("T")[0];

  const { data: expiringSoon } = await supabase
    .from("estimates")
    .select("id, title, estimate_number, valid_until, tenant_id, property_managers(full_name)")
    .in("status", ["draft", "sent"])
    .in("valid_until", [warn3Str, warn1Str]);

  let warned = 0;
  if (resend && expiringSoon?.length) {
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "";

    // Group by tenant to batch-load owner emails
    const tenantIds = Array.from(new Set(expiringSoon.map((e) => e.tenant_id)));
    const { data: owners } = await supabase
      .from("profiles")
      .select("tenant_id, email, full_name")
      .eq("role", "owner")
      .in("tenant_id", tenantIds);

    const ownerByTenant: Record<string, { email: string; full_name: string }> = {};
    for (const o of owners ?? []) ownerByTenant[o.tenant_id] = o;

    for (const est of expiringSoon) {
      const owner = ownerByTenant[est.tenant_id];
      if (!owner?.email) continue;

      const daysLeft = est.valid_until === warn1Str ? 1 : 3;
      const pmName = (est.property_managers as any)?.full_name ?? "your client";

      await resend.emails.send({
        from: getFromAddress(),
        to: owner.email,
        subject: `Estimate expiring in ${daysLeft} day${daysLeft > 1 ? "s" : ""}: ${est.estimate_number}`,
        html: renderEmailLayout({
          tenantName: "Foreman",
          category: "Estimate Expiry Warning",
          title: `Estimate expiring in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`,
          greeting: `Hi ${owner.full_name ?? "there"},`,
          intro: `Estimate ${est.estimate_number} for ${pmName} expires on ${est.valid_until}. Follow up now to keep the deal moving.`,
          previewText: `Estimate ${est.estimate_number} expires in ${daysLeft} day${daysLeft > 1 ? "s" : ""}.`,
          sections: [
            renderNoticeCard({
              tone: "warning",
              eyebrow: `Expiring in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`,
              title: est.estimate_number,
              body: `Client: ${pmName} · Expires: ${est.valid_until}`,
            }),
          ],
          primaryAction: {
            href: `${appUrl}/owner/estimates/${est.id}`,
            label: "View Estimate",
          },
          footerText: "Log in to your dashboard to follow up or extend the expiry.",
        }),
      }).catch((err) => console.error("[email] estimate expiry warning:", err));
      warned++;
    }
  }

  // Mark past-due estimates as expired (optional status transition)
  const { data: expired } = await supabase
    .from("estimates")
    .update({ status: "declined" })
    .in("status", ["sent"])
    .lt("valid_until", todayStr)
    .select("id");

  return NextResponse.json({
    ok: true,
    warned,
    expired: expired?.length ?? 0,
  });
}
