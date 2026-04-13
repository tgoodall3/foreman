import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { errorResponse } from "@/lib/api";
import { renderDetailCard, renderEmailLayout, renderMessageCard, renderNoticeCard } from "@/lib/email";

const resend = new Resend(process.env.RESEND_API_KEY);

type Action = "approve" | "decline";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const profile = await requireOwner();
    const { action } = (await req.json().catch(() => ({}))) as { action?: Action };

    if (action !== "approve" && action !== "decline") {
      return errorResponse("Invalid action.", 400);
    }

    const supabase = await createServerSideClient();

    const { data: request } = await supabase
      .from("time_change_requests")
      .select("id, tenant_id, worker_id, time_entry_id, requested_clocked_in_at, requested_clocked_out_at, requested_date, reason")
      .eq("id", params.id)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();

    if (!request) return errorResponse("Request not found.", 404);

    let updatedEntry: any = null;

    if (action === "approve") {
      if (request.time_entry_id) {
        const { data } = await supabase
          .from("time_entries")
          .update({
            clocked_in_at: request.requested_clocked_in_at ?? undefined,
            clocked_out_at: request.requested_clocked_out_at ?? undefined,
          })
          .eq("id", request.time_entry_id)
          .eq("tenant_id", profile.tenant_id)
          .select()
          .maybeSingle();
        updatedEntry = data ?? null;
      } else if (request.requested_clocked_in_at && request.requested_clocked_out_at) {
        const { data } = await supabase
          .from("time_entries")
          .insert({
            tenant_id: profile.tenant_id,
            worker_id: request.worker_id,
            clocked_in_at: request.requested_clocked_in_at,
            clocked_out_at: request.requested_clocked_out_at,
            notes: "Added via approved change request",
          })
          .select()
          .maybeSingle();
        updatedEntry = data ?? null;
      }
    }

    const { data: updatedRequest, error } = await supabase
      .from("time_change_requests")
      .update({ status: action === "approve" ? "approved" : "declined" })
      .eq("id", request.id)
      .eq("tenant_id", profile.tenant_id)
      .select()
      .maybeSingle();

    if (error) return errorResponse("Failed to update request.", 500);

    if (process.env.RESEND_API_KEY) {
      const [{ data: worker }, { data: tenant }] = await Promise.all([
        supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", request.worker_id)
          .maybeSingle(),
        supabase.from("tenants").select("name").eq("id", profile.tenant_id).single(),
      ]);

      if (worker?.email) {
        const tenantName = tenant?.name || "Foreman";
        await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: worker.email,
          subject: `Your time change request was ${updatedRequest.status}`,
          html: renderEmailLayout({
            tenantName,
            category: "Timesheet Request",
            title: `Request ${updatedRequest.status}`,
            greeting: `Hi ${worker.full_name || "there"},`,
            intro: `Your time change request has been ${updatedRequest.status}.`,
            previewText: `Your time change request was ${updatedRequest.status}.`,
            sections: [
              renderNoticeCard({
                tone: updatedRequest.status === "approved" ? "success" : "danger",
                eyebrow: "Decision",
                title: updatedRequest.status === "approved" ? "Request approved" : "Request declined",
                body: `Date: ${request.requested_date}`,
              }),
              renderDetailCard("Request details", [
                { label: "Date", value: request.requested_date },
                {
                  label: "Requested time",
                  value: `${request.requested_clocked_in_at || "Not provided"} to ${request.requested_clocked_out_at || "Not provided"}`,
                },
              ]),
              renderMessageCard("Reason", request.reason),
            ],
            footerText: "Reply to your owner if you have questions about this decision.",
          }),
        }).catch((err) => console.error("[email] time change request response:", err));
      }
    }

    return NextResponse.json({ request: updatedRequest, entry: updatedEntry });
  } catch {
    return errorResponse("Internal server error.", 500);
  }
}
