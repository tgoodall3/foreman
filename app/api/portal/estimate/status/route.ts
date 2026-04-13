import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { logError } from "@/lib/logger";
import { audit } from "@/lib/audit";

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
      : NextResponse.redirect(new URL(`/portal/estimate?token=${req.nextUrl.searchParams.get("token") || ""}&result=error`, siteUrl));
  }

  let token: string | undefined;
  let status: string | undefined;
  let signatureName: string | undefined;

  if (isJson) {
    const body = await req.json().catch(() => ({}));
    token     = body.token;
    status    = body.status;
    signatureName = body.signature_name;
  } else {
    const formData = await req.formData();
    token     = formData.get("token")?.toString();
    status    = formData.get("status")?.toString();
    signatureName = formData.get("signature_name")?.toString();
  }

  if (!token || !status || !["approved", "declined"].includes(status)) {
    if (isJson) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    return NextResponse.redirect(new URL(`/portal/estimate?token=${token || ""}&result=error`, siteUrl));
  }

  const supabase = createServiceClient();

  const update: Record<string, string> = { status };
  if (status === "approved" && signatureName?.trim()) {
    update.signature_name = signatureName.trim();
    update.signed_at = new Date().toISOString();
  }

  // Load current status to make the operation idempotent
  const { data: existing, error: fetchError } = await supabase
    .from("estimates")
    .select("id, status, title, estimate_number, total, tenant_id, property_managers(full_name, email)")
    .eq("approval_token", token)
    .single();

  if (fetchError || !existing) {
    const message = "Estimate not found.";
    return isJson
      ? NextResponse.json({ error: message }, { status: 404 })
      : NextResponse.redirect(new URL(`/portal/estimate?token=${token || ""}&result=error`, siteUrl));
  }

  const terminalStatuses = ["approved", "declined", "converted"];
  if (terminalStatuses.includes(existing.status)) {
    // Already resolved — keep status and skip update
    if (isJson) return NextResponse.json({ ok: true, status: existing.status, alreadyFinal: true });
    return NextResponse.redirect(new URL(`/portal/estimate?token=${token}&result=${existing.status}`, siteUrl));
  }

  const { data: estimate, error: updateError } = await supabase
    .from("estimates")
    .update(update)
    .eq("id", existing.id)
    .select("id, title, estimate_number, total, tenant_id, property_managers(full_name, email)")
    .single();

  if (updateError || !estimate) {
    logError("Estimate approval update failed", updateError || "estimate_not_found");
    const message = "Unable to record your response. Please try again.";
    return isJson
      ? NextResponse.json({ error: message }, { status: 500 })
      : NextResponse.redirect(new URL(`/portal/estimate?token=${token}&result=error`, siteUrl));
  }

  audit({
    tenant_id: estimate.tenant_id,
    entity_type: "estimate",
    entity_id: estimate.id,
    entity_label: estimate.estimate_number,
    action: status === "approved" ? "approved" : "declined",
    metadata: signatureName ? { signature_name: signatureName } : {},
  });

  // Notify the owner when a PM approves or declines
  if (estimate && process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const [{ data: owner }, { data: tenant }] = await Promise.all([
      supabase.from("profiles").select("email, full_name").eq("tenant_id", estimate.tenant_id).eq("role", "owner").single(),
      supabase.from("tenants").select("name").eq("id", estimate.tenant_id).single(),
    ]);

    if (owner?.email) {
      const pmName = (estimate as any).property_managers?.full_name ?? "Your client";
      const action = status === "approved" ? "approved" : "declined";
      const actionColor = status === "approved" ? "#16a34a" : "#dc2626";
      const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || siteUrl;

      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: owner.email,
        subject: `Estimate ${action}: ${estimate.estimate_number} — ${pmName}`,
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="background:#0f1923;border-radius:12px 12px 0 0;padding:24px 32px;">
    <p style="margin:0;font-size:18px;font-weight:800;color:#fff;">${tenant?.name ?? "Foreman"}</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Estimate Update</p>
  </td></tr>
  <tr><td style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;">
    <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hi ${owner.full_name ?? "there"},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
      <strong style="color:${actionColor};">${pmName} has ${action} estimate ${estimate.estimate_number}</strong>${status === "approved" && signatureName ? ` and signed as <em>${signatureName}</em>` : ""}.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f8f5;border-radius:10px;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;">Estimate</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#0f1923;">${estimate.title}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${estimate.estimate_number}</p>
      </td></tr>
    </table>
    <a href="${appUrl}/owner/estimates/${estimate.id}" style="display:inline-block;background:#f59e0b;color:#0f1923;padding:14px 32px;border-radius:10px;font-weight:800;font-size:15px;text-decoration:none;">
      ${status === "approved" ? "Convert to Job →" : "View Estimate →"}
    </a>
  </td></tr>
  <tr><td style="background:#f9f8f5;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#d1d5db;">Powered by Foreman</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`,
      }).catch((err) => console.error("[email] estimate status notification:", err));
    }
  }

  if (isJson) return NextResponse.json({ ok: true, status });
  return NextResponse.redirect(new URL(`/portal/estimate?token=${token}&result=${status}`, siteUrl));
}
