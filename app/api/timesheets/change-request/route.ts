import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireWorker } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { errorResponse } from "@/lib/api";
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

    // Validate time order: clocked_out must be after clocked_in
    if (parsed.data.requested_clocked_in_at && parsed.data.requested_clocked_out_at) {
      const inTime  = new Date(parsed.data.requested_clocked_in_at);
      const outTime = new Date(parsed.data.requested_clocked_out_at);
      if (outTime <= inTime) {
        return errorResponse("Clock-out time must be after clock-in time.", 400);
      }
      // Reject suspiciously long shifts (> 24 hours)
      if (outTime.getTime() - inTime.getTime() > 24 * 60 * 60 * 1000) {
        return errorResponse("Requested shift duration cannot exceed 24 hours.", 400);
      }
    }

    const supabase = await createServerSideClient();

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

    // Notify owners in the tenant (fire-and-forget)
    const { data: owners } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("tenant_id", worker.tenant_id)
      .eq("role", "owner");

    if (owners && owners.length && resend && process.env.EMAIL_FROM) {
      owners.forEach((owner: any) => {
        resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: owner.email,
          subject: "New time change request",
          html: `<p>${worker.full_name} submitted a time change request for ${parsed.data.requested_date}.</p>`
        }).catch(() => {});
      });
    }

    return NextResponse.json({ request: inserted });
  } catch (err) {
    return errorResponse("Internal server error", 500);
  }
}
