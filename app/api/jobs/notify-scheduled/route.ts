import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getProfile } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { Resend } from "resend";
import { getFromAddress, renderDetailCard, renderEmailLayout, renderNoticeCard } from "@/lib/email";
import { formatDate } from "@/lib/utils";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req: NextRequest) {
  const profile = await getProfile();
  if (!profile || profile.role !== "owner") {
    return errorResponse("Unauthorized", 401);
  }

  const { jobId } = await req.json();
  if (!jobId) return NextResponse.json({ ok: true });

  const supabase = createServiceClient();

  // Fetch job with its linked work order and PM info
  const { data: job } = await supabase
    .from("jobs")
    .select(`
      id, title, description, scheduled_date, scheduled_time, tenant_id,
      properties(name, address, city, state),
      work_orders(
        id, title,
        property_managers(id, full_name, email, portal_token)
      )
    `)
    .eq("id", jobId)
    .single();

  if (!job || !job.scheduled_date) return NextResponse.json({ ok: true });
  if (job.tenant_id !== profile.tenant_id) return NextResponse.json({ ok: true });

  // Only notify if this job came from a work order
  const wo = Array.isArray(job.work_orders) ? job.work_orders[0] : (job as any).work_orders;
  if (!wo) return NextResponse.json({ ok: true });

  const pm = Array.isArray(wo.property_managers) ? wo.property_managers[0] : (wo as any).property_managers;
  if (!pm?.email) return NextResponse.json({ ok: true });

  if (!resend) return NextResponse.json({ ok: true });

  const { data: tenantData } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", job.tenant_id)
    .single();

  const tenantName = tenantData?.name || "Foreman";
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const portalUrl = pm.portal_token
    ? `${appUrl}/portal?token=${encodeURIComponent(pm.portal_token)}`
    : undefined;

  const prop = Array.isArray(job.properties) ? job.properties[0] : (job as any).properties;

  const formattedDate = new Date(job.scheduled_date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const html = renderEmailLayout({
    tenantName,
    category: "Job Update",
    title: "Your job has been scheduled",
    greeting: `Hi ${pm.full_name ?? "there"},`,
    intro: `Good news — a date has been confirmed for your job with ${tenantName}.`,
    sections: [
      renderNoticeCard({
        tone: "success",
        eyebrow: "Scheduled",
        title: job.title,
        body: [
          prop?.name ? `Property: ${prop.name}` : null,
          `Date: ${formattedDate}${job.scheduled_time ? ` at ${job.scheduled_time}` : ""}`,
        ].filter(Boolean).join(" · ") || undefined,
      }),
      renderDetailCard("Details", [
        { label: "Date", value: `${formattedDate}${job.scheduled_time ? ` at ${job.scheduled_time}` : ""}` },
        prop ? {
          label: "Location",
          htmlValue: `${prop.name}${prop.address ? `<br />${prop.address}, ${prop.city}, ${prop.state}` : ""}`,
        } : { label: "Location", value: "Not set" },
      ]),
    ],
    primaryAction: portalUrl ? { href: portalUrl, label: "View in Portal" } : undefined,
    footerText: "Questions? Reply to this email or visit your portal.",
  });

  await resend.emails.send({
    from: getFromAddress(tenantName),
    to: pm.email,
    subject: `Job scheduled for ${formattedDate} — ${job.title}`,
    html,
  }).catch((err) => console.error("[email] job scheduled:", err));

  return NextResponse.json({ ok: true });
}
