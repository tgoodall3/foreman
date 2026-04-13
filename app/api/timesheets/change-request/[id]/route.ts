import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { errorResponse } from "@/lib/api";

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

    // Load the request
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
        // Update an existing entry with provided times
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
        // Create a new entry when the worker forgot to clock
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

    // Notify the worker (best-effort)
    if (process.env.RESEND_API_KEY) {
      const { data: worker } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", request.worker_id)
        .maybeSingle();

      if (worker?.email) {
        const html = `
          <div style="font-family: Arial, sans-serif; color: #0f1923;">
            <p style="font-size:14px; margin:0 0 8px;">Your time change request has been ${updatedRequest.status}.</p>
            <p style="font-size:13px; margin:0 0 6px;"><strong>Date:</strong> ${request.requested_date}</p>
            <p style="font-size:13px; margin:0 0 6px;"><strong>Requested:</strong> ${request.requested_clocked_in_at ?? "—"} to ${request.requested_clocked_out_at ?? "—"}</p>
            <p style="font-size:13px; margin:0 0 10px;"><strong>Reason:</strong> ${request.reason}</p>
            <p style="font-size:12px; color:#6b7280; margin:0;">If this looks wrong, reply to your owner.</p>
          </div>
        `;

        await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: worker.email,
          subject: `Your time change request was ${updatedRequest.status}`,
          html,
        }).catch((err) => console.error("[email] time change request response:", err));
      }
    }

    return NextResponse.json({ request: updatedRequest, entry: updatedEntry });
  } catch {
    return errorResponse("Internal server error.", 500);
  }
}
