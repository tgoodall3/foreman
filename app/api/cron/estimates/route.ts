import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";

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
      if (!owner?.email || !process.env.EMAIL_FROM) continue;

      const daysLeft = est.valid_until === warn1Str ? 1 : 3;
      const pmName = (est.property_managers as any)?.full_name ?? "your client";

      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: owner.email,
        subject: `Estimate expiring in ${daysLeft} day${daysLeft > 1 ? "s" : ""}: ${est.estimate_number}`,
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="background:#0f1923;border-radius:12px 12px 0 0;padding:24px 32px;">
    <p style="margin:0;font-size:18px;font-weight:800;color:#fff;">Foreman</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Estimate Expiry Warning</p>
  </td></tr>
  <tr><td style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;">
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;font-weight:700;color:#d97706;">Expiring in ${daysLeft} day${daysLeft > 1 ? "s" : ""}</p>
    </div>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;">Hi ${owner.full_name ?? "there"},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
      Estimate <strong>${est.estimate_number}</strong> for <strong>${pmName}</strong> expires on <strong>${est.valid_until}</strong>.
      Follow up now to keep the deal moving.
    </p>
    <a href="${appUrl}/owner/estimates/${est.id}" style="display:inline-block;background:#f59e0b;color:#0f1923;padding:14px 32px;border-radius:10px;font-weight:800;font-size:15px;text-decoration:none;">
      View Estimate →
    </a>
  </td></tr>
  <tr><td style="background:#f9f8f5;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#d1d5db;">Powered by Foreman</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`,
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
