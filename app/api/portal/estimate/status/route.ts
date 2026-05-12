import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { logError } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { getFromAddress, renderDetailCard, renderEmailLayout, renderNoticeCard } from "@/lib/email";

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

  const trimmedSig = signatureName?.trim().slice(0, 200) ?? "";
  const update: Record<string, string> = { status };
  if (status === "approved" && trimmedSig) {
    update.signature_name = trimmedSig;
    update.signed_at = new Date().toISOString();
  }

  // Load current status to make the operation idempotent
  const { data: existing, error: fetchError } = await supabase
    .from("estimates")
    .select("id, status, valid_until, title, estimate_number, total, tenant_id, property_managers(full_name, email)")
    .eq("approval_token", token)
    .single();

  if (fetchError || !existing) {
    const message = "Estimate not found.";
    return isJson
      ? NextResponse.json({ error: message }, { status: 404 })
      : NextResponse.redirect(new URL(`/portal/estimate?token=${token || ""}&result=error`, siteUrl));
  }

  // Reject approvals on expired estimates (declines are still allowed)
  if (
    status === "approved" &&
    existing.valid_until &&
    new Date(existing.valid_until) < new Date()
  ) {
    const message = "This estimate has expired and can no longer be approved.";
    return isJson
      ? NextResponse.json({ error: message }, { status: 410 })
      : NextResponse.redirect(new URL(`/portal/estimate?token=${token}&result=expired`, siteUrl));
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
      const isApproved = status === "approved";
      const action = isApproved ? "approved" : "declined";
      const tenantName = tenant?.name ?? "Foreman";
      const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || siteUrl;
      const signatureNote = isApproved && signatureName ? ` · Signed as "${signatureName}"` : "";

      await resend.emails.send({
        from: getFromAddress(tenantName),
        to: owner.email,
        subject: `Estimate ${action}: ${estimate.estimate_number} — ${pmName}`,
        html: renderEmailLayout({
          tenantName,
          category: "Estimate Update",
          title: isApproved ? "Estimate approved" : "Estimate declined",
          greeting: `Hi ${owner.full_name ?? "there"},`,
          intro: `${pmName} has ${action} estimate ${estimate.estimate_number}${signatureNote}.`,
          sections: [
            renderNoticeCard({
              tone: isApproved ? "success" : "danger",
              eyebrow: isApproved ? "Approved" : "Declined",
              title: estimate.title,
            }),
            renderDetailCard("Estimate details", [
              { label: "Number", value: estimate.estimate_number },
              { label: "Client", value: pmName },
            ]),
          ],
          primaryAction: {
            href: `${appUrl}/owner/estimates/${estimate.id}`,
            label: isApproved ? "Convert to Job" : "View Estimate",
          },
          footerText: "Log in to your dashboard to take the next step.",
        }),
      }).catch((err) => console.error("[email] estimate status notification:", err));
    }
  }

  if (isJson) return NextResponse.json({ ok: true, status });
  return NextResponse.redirect(new URL(`/portal/estimate?token=${token}&result=${status}`, siteUrl));
}
