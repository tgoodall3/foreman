import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { getFromAddress, renderDetailCard, renderEmailLayout, renderMessageCard, renderNoticeCard } from "@/lib/email";
import { formatDate } from "@/lib/utils";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) return;

  const params = new URLSearchParams();
  params.append("To", to);
  params.append("From", from);
  params.append("Body", body);

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  }).catch((err) => console.error("[sms] notify-assigned:", err));
}

export async function POST(req: NextRequest) {
  const { jobId, workerIds } = await req.json();
  if (!jobId || !workerIds?.length) return NextResponse.json({ ok: true });

  const supabase = createServiceClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("*, properties(name, address, city, state)")
    .eq("id", jobId)
    .single();

  if (!job) return NextResponse.json({ ok: true });

  const { data: tenantData } = await supabase.from("tenants").select("name").eq("id", job.tenant_id).single();
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  const { data: workers } = await supabase
    .from("profiles")
    .select("email, full_name, phone")
    .in("id", workerIds)
    .eq("tenant_id", job.tenant_id);

  if (!workers?.length) return NextResponse.json({ ok: true });

  supabase
    .channel(`assignments-${job.tenant_id}`)
    .send({
      type: "broadcast",
      event: "job-assigned",
      payload: {
        workerIds,
        title: job.title,
      },
    })
    .catch((err) => console.error("[broadcast] job-assigned:", err));

  if (resend && process.env.EMAIL_FROM) {
    const tenantName = tenantData?.name || "Foreman";

    for (const worker of workers) {
      await resend.emails.send({
        from: getFromAddress(tenantName),
        to: worker.email,
        subject: `New Job Assigned: ${job.title}`,
        html: renderEmailLayout({
          tenantName,
          category: "Worker Assignment",
          title: "You have a new job assignment",
          greeting: `Hi ${worker.full_name},`,
          intro: `You were assigned a new job by ${tenantName}.`,
          previewText: `New assignment: ${job.title}.`,
          sections: [
            renderNoticeCard({
              tone: "warning",
              eyebrow: "New assignment",
              title: job.title,
              bodyHtml: job.properties ? `Location: ${(job.properties as any).name}` : undefined,
            }),
            renderDetailCard("Assignment details", [
              {
                label: "Date",
                value: job.scheduled_date
                  ? `${formatDate(job.scheduled_date)}${job.scheduled_time ? ` at ${job.scheduled_time}` : ""}`
                  : "Unscheduled",
              },
              {
                label: "Location",
                htmlValue: job.properties
                  ? `${(job.properties as any).name}<br />${(job.properties as any).address}, ${(job.properties as any).city}, ${(job.properties as any).state}`
                  : "Not set",
              },
            ]),
            job.description ? renderMessageCard("Job details", job.description) : "",
          ],
          primaryAction: {
            href: `${appUrl}/worker`,
            label: "View my jobs",
          },
          footerText: "Open your worker dashboard to review the assignment and update status.",
        }),
      });
    }
  }

  if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_FROM) {
    for (const worker of workers) {
      if (!worker.phone) continue;
      const when = job.scheduled_date ? `${formatDate(job.scheduled_date)}${job.scheduled_time ? " at " + job.scheduled_time : ""}` : "unscheduled";
      const loc = job.properties ? `${(job.properties as any).name ?? ""}` : "";
      const body = `New job assigned: ${job.title}${loc ? " at " + loc : ""}${when ? " (" + when + ")" : ""}. View: ${appUrl}/worker`;
      sendSms(worker.phone, body);
    }
  }

  return NextResponse.json({ ok: true });
}
