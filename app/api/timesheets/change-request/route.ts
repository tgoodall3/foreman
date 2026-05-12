import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireWorker } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { errorResponse } from "@/lib/api";
import { getFromAddress, renderDetailCard, renderEmailLayout, renderMessageCard, renderNoticeCard } from "@/lib/email";
import { z } from "zod";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const schema = z.object({
  requested_date: z.string(),
  requested_clocked_in_at: z.string().datetime({ offset: true }).optional().nullable(),
  requested_clocked_out_at: z.string().datetime({ offset: true }).optional().nullable(),
  reason: z.string().min(1).max(500),
  time_entry_id: z.string().uuid().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const worker = await requireWorker();
    if (!worker) return errorResponse("Unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return errorResponse("Invalid payload", 400);

    if (parsed.data.requested_clocked_in_at && parsed.data.requested_clocked_out_at) {
      const inTime = new Date(parsed.data.requested_clocked_in_at);
      const outTime = new Date(parsed.data.requested_clocked_out_at);
      if (outTime <= inTime) {
        return errorResponse("Clock-out time must be after clock-in time.", 400);
      }
      if (outTime.getTime() - inTime.getTime() > 24 * 60 * 60 * 1000) {
        return errorResponse("Requested shift duration cannot exceed 24 hours.", 400);
      }
    }

    const supabase = await createServerSideClient();

    // Verify time_entry_id belongs to this worker
    if (parsed.data.time_entry_id) {
      const { data: entry } = await supabase
        .from("time_entries")
        .select("id")
        .eq("id", parsed.data.time_entry_id)
        .eq("worker_id", worker.id)
        .single();
      if (!entry) return errorResponse("Time entry not found.", 404);
    }

    const { data: inserted, error } = await supabase
      .from("time_change_requests")
      .insert({
        tenant_id: worker.tenant_id,
        worker_id: worker.id,
        time_entry_id: parsed.data.time_entry_id ?? null,
        requested_date: parsed.data.requested_date,
        requested_clocked_in_at: parsed.data.requested_clocked_in_at ?? null,
        requested_clocked_out_at: parsed.data.requested_clocked_out_at ?? null,
        reason: parsed.data.reason,
        status: "pending",
      })
      .select()
      .single();

    if (error) return errorResponse("Failed to create request", 500);

    const [{ data: owners }, { data: tenant }] = await Promise.all([
      supabase
        .from("profiles")
        .select("email, full_name")
        .eq("tenant_id", worker.tenant_id)
        .eq("role", "owner"),
      supabase.from("tenants").select("name").eq("id", worker.tenant_id).single(),
    ]);

    if (owners && owners.length && resend && process.env.EMAIL_FROM) {
      const tenantName = tenant?.name || "Foreman";
      owners.forEach((owner: any) => {
        resend.emails.send({
          from: getFromAddress(tenantName),
          to: owner.email,
          subject: "New time change request",
          html: renderEmailLayout({
            tenantName,
            category: "Timesheet Request",
            title: "A worker submitted a time change request",
            greeting: `Hi ${owner.full_name || "there"},`,
            intro: `${worker.full_name} submitted a time change request for review.`,
            previewText: `${worker.full_name} requested a time change for ${parsed.data.requested_date}.`,
            sections: [
              renderNoticeCard({
                tone: "warning",
                eyebrow: "Pending review",
                title: worker.full_name || "Worker",
                body: `Requested date: ${parsed.data.requested_date}`,
              }),
              renderDetailCard("Request details", [
                { label: "Worker", value: worker.full_name || "Worker" },
                { label: "Date", value: parsed.data.requested_date },
                {
                  label: "Requested time",
                  value: `${parsed.data.requested_clocked_in_at || "Not provided"} to ${parsed.data.requested_clocked_out_at || "Not provided"}`,
                },
              ]),
              renderMessageCard("Reason", parsed.data.reason),
            ],
            footerText: "Review the request from the timesheet change requests page in Foreman.",
          }),
        }).catch((err) => console.error("[email] time change request notification:", err));
      });
    }

    return NextResponse.json({ request: inserted });
  } catch {
    return errorResponse("Internal server error", 500);
  }
}
