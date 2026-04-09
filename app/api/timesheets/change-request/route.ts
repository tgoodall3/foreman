import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireWorker } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { errorResponse } from "@/lib/api";

const resend = new Resend(process.env.RESEND_API_KEY);

type Body = {
  time_entry_id?: string;
  requested_date?: string; // YYYY-MM-DD
  requested_clocked_in_at?: string; // ISO
  requested_clocked_out_at?: string; // ISO
  reason?: string;
};

function isISODate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function isISODateTime(value: string | undefined) {
  if (!value) return true;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireWorker();
    const supabase = await createServerSideClient();

    const body = (await req.json().catch(() => ({}))) as Body;
    const {
      time_entry_id,
      requested_date,
      requested_clocked_in_at,
      requested_clocked_out_at,
      reason,
    } = body;

    if (!reason || reason.trim().length < 5) {
      return errorResponse("Reason is required (min 5 characters).", 400);
    }

    if (!requested_date || !isISODate(requested_date)) {
      return errorResponse("requested_date must be YYYY-MM-DD.", 400);
    }

    if (!isISODateTime(requested_clocked_in_at) || !isISODateTime(requested_clocked_out_at)) {
      return errorResponse("Invalid time format. Use ISO strings.", 400);
    }

    // If a time_entry_id is supplied, ensure it belongs to this worker.
    if (time_entry_id) {
      const { data: entry } = await supabase
        .from("time_entries")
        .select("id")
        .eq("id", time_entry_id)
        .eq("worker_id", profile.id)
        .maybeSingle();

      if (!entry) {
        return errorResponse("Time entry not found.", 404);
      }
    }

    const { data, error } = await supabase
      .from("time_change_requests")
      .insert({
        tenant_id: profile.tenant_id,
        worker_id: profile.id,
        time_entry_id: time_entry_id ?? null,
        requested_date,
        requested_clocked_in_at: requested_clocked_in_at ?? null,
        requested_clocked_out_at: requested_clocked_out_at ?? null,
        reason: reason.trim(),
      })
      .select()
      .single();

    if (error) return errorResponse("Failed to submit request.", 500);

    // Notify the owner(s) by email (best-effort)
    if (process.env.RESEND_API_KEY) {
      const { data: owners } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("tenant_id", profile.tenant_id)
        .eq("role", "owner");

      const ownerEmails = (owners ?? []).map((o: any) => o.email).filter(Boolean);
      if (ownerEmails.length > 0) {
        const html = `
          <div style="font-family: Arial, sans-serif; color: #0f1923;">
            <p style="font-size:14px; margin:0 0 8px;">New time change request from ${profile.full_name}</p>
            <p style="font-size:13px; margin:0 0 8px;"><strong>Date:</strong> ${requested_date}</p>
            <p style="font-size:13px; margin:0 0 8px;"><strong>Requested:</strong> ${requested_clocked_in_at ?? "—"} to ${requested_clocked_out_at ?? "—"}</p>
            <p style="font-size:13px; margin:0 0 0;"><strong>Reason:</strong> ${reason.trim()}</p>
          </div>
        `;

        await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: ownerEmails,
          subject: `Time change request from ${profile.full_name}`,
          html,
        }).catch(() => {});
      }
    }

    return NextResponse.json({ request: data });
  } catch {
    return errorResponse("Internal server error.", 500);
  }
}
