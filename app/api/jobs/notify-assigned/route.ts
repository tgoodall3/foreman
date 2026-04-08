import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { formatDate } from "@/lib/utils";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { jobId, workerIds } = await req.json();
  if (!jobId || !workerIds?.length) return NextResponse.json({ ok: true });

  const supabase = createServiceClient();

  const [{ data: job }, { data: workers }] = await Promise.all([
    supabase.from("jobs").select("*, properties(name, address, city, state), tenants(name)").eq("id", jobId).single(),
    supabase.from("profiles").select("email, full_name").in("id", workerIds),
  ]);

  if (!job || !workers?.length || !process.env.RESEND_API_KEY) return NextResponse.json({ ok: true });

  for (const worker of workers) {
    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: worker.email,
      subject: `New Job Assigned: ${job.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; color: #0f1923;">
          <h2>Hi ${worker.full_name},</h2>
          <p>You've been assigned a new job by <strong>${(job.tenants as any)?.name}</strong>.</p>
          <table style="background:#f5f4f0; border-radius:8px; padding:16px; width:100%; margin:16px 0;">
            <tr><td style="font-weight:600; padding-bottom:8px;">Job:</td><td>${job.title}</td></tr>
            ${job.scheduled_date ? `<tr><td style="font-weight:600; padding-bottom:8px;">Date:</td><td>${formatDate(job.scheduled_date)}${job.scheduled_time ? ` at ${job.scheduled_time}` : ""}</td></tr>` : ""}
            ${job.properties ? `<tr><td style="font-weight:600; padding-bottom:8px;">Location:</td><td>${(job.properties as any).name}<br>${(job.properties as any).address}, ${(job.properties as any).city}, ${(job.properties as any).state}</td></tr>` : ""}
            ${job.description ? `<tr><td style="font-weight:600; padding-bottom:8px;">Details:</td><td>${job.description}</td></tr>` : ""}
          </table>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/worker" style="display:inline-block; background:#f59e0b; color:#0f1923; padding:10px 20px; border-radius:8px; font-weight:700; text-decoration:none;">
            View My Jobs →
          </a>
        </div>
      `,
    });
  }

  return NextResponse.json({ ok: true });
}
