import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { logError } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { getFromAddress, renderDetailCard, renderEmailLayout, renderNoticeCard } from "@/lib/email";
import { formatCurrency } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  if (!siteUrl) {
    const message = "Site URL is not configured.";
    return isJson
      ? NextResponse.json({ error: message }, { status: 500 })
      : NextResponse.redirect(new URL("/portal", req.nextUrl));
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const message = "Missing SUPABASE_SERVICE_ROLE_KEY";
    return isJson
      ? NextResponse.json({ error: message }, { status: 500 })
      : NextResponse.redirect(new URL(`/portal/change-order?token=${req.nextUrl.searchParams.get("token") || ""}&result=error`, siteUrl));
  }

  let token: string | undefined;
  let status: string | undefined;

  if (isJson) {
    const body = await req.json().catch(() => ({}));
    token  = body.token;
    status = body.status;
  } else {
    const formData = await req.formData();
    token  = formData.get("token")?.toString();
    status = formData.get("status")?.toString();
  }

  if (!token || !status || !["approved", "declined"].includes(status)) {
    if (isJson) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    return NextResponse.redirect(new URL(`/portal/change-order?token=${token || ""}&result=error`, siteUrl));
  }

  const supabase = createServiceClient();

  const { data: existing, error: fetchError } = await supabase
    .from("change_orders")
    .select("id, status, title, change_order_number, total, tenant_id, property_managers(full_name, email)")
    .eq("approval_token", token)
    .single();

  if (fetchError || !existing) {
    const message = "Change order not found.";
    return isJson
      ? NextResponse.json({ error: message }, { status: 404 })
      : NextResponse.redirect(new URL(`/portal/change-order?token=${token || ""}&result=error`, siteUrl));
  }

  if (existing.status === "approved" || existing.status === "declined") {
    if (isJson) return NextResponse.json({ ok: true, status: existing.status, alreadyFinal: true });
    return NextResponse.redirect(new URL(`/portal/change-order?token=${token}&result=${existing.status}`, siteUrl));
  }

  const { data: changeOrder, error: updateError } = await supabase
    .from("change_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", existing.id)
    .select("id, title, change_order_number, total, tenant_id, property_managers(full_name, email)")
    .single();

  if (updateError || !changeOrder) {
    logError("Change order approval update failed", updateError || "not_found");
    const message = "Unable to record your response. Please try again.";
    return isJson
      ? NextResponse.json({ error: message }, { status: 500 })
      : NextResponse.redirect(new URL(`/portal/change-order?token=${token}&result=error`, siteUrl));
  }

  audit({
    tenant_id: changeOrder.tenant_id,
    entity_type: "change_order",
    entity_id: changeOrder.id,
    entity_label: changeOrder.change_order_number,
    action: status === "approved" ? "approved" : "declined",
    metadata: {},
  });

  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const [{ data: owner }, { data: tenant }] = await Promise.all([
      supabase.from("profiles").select("email, full_name").eq("tenant_id", changeOrder.tenant_id).eq("role", "owner").single(),
      supabase.from("tenants").select("name").eq("id", changeOrder.tenant_id).single(),
    ]);

    if (owner?.email) {
      const pmName = (changeOrder as any).property_managers?.full_name ?? "Your client";
      const isApproved = status === "approved";
      const action = isApproved ? "approved" : "declined";
      const tenantName = tenant?.name ?? "Foreman";
      const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || siteUrl;

      await resend.emails.send({
        from: getFromAddress(tenantName),
        to: owner.email,
        subject: `Change Order ${action}: ${changeOrder.change_order_number} — ${pmName}`,
        html: renderEmailLayout({
          tenantName,
          category: "Change Order Update",
          title: isApproved ? "Change order approved" : "Change order declined",
          greeting: `Hi ${owner.full_name ?? "there"},`,
          intro: `${pmName} has ${action} change order ${changeOrder.change_order_number}.`,
          sections: [
            renderNoticeCard({
              tone: isApproved ? "success" : "danger",
              eyebrow: isApproved ? "Approved" : "Declined",
              title: changeOrder.title,
            }),
            renderDetailCard("Change order details", [
              { label: "Number", value: changeOrder.change_order_number },
              { label: "Total", value: formatCurrency(changeOrder.total) },
              { label: "Client", value: pmName },
            ]),
          ],
          primaryAction: {
            href: `${appUrl}/owner/jobs`,
            label: "View Jobs",
          },
          footerText: "Log in to your dashboard to review the change order.",
        }),
      }).catch((err) => console.error("[email] change order status notification:", err));
    }
  }

  if (isJson) return NextResponse.json({ ok: true, status });
  return NextResponse.redirect(new URL(`/portal/change-order?token=${token}&result=${status}`, siteUrl));
}
