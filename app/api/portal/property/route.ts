import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase";
import { errorResponse, jsonResponse } from "@/lib/api";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const schema = z.object({
  token: z.string().min(10),
  name: z.string().min(2).max(120),
  address: z.string().min(5).max(200),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  zip: z.string().min(3).max(20),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return errorResponse("Invalid input.", 400);
    const { token, name, address, city, state, zip, notes } = parsed.data;

    const supabase = createServiceClient();

    const { data: pm } = await supabase
      .from("property_managers")
      .select("id, tenant_id, full_name, email")
      .eq("portal_token", token)
      .single();

    if (!pm) return errorResponse("Invalid link.", 404);

    const { data: property, error } = await supabase
      .from("properties")
      .insert({
        tenant_id: pm.tenant_id,
        property_manager_id: pm.id,
        name,
        address,
        city,
        state,
        zip,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) return errorResponse("Could not save property.", 500);

    // Notify owner (best-effort)
    if (process.env.RESEND_API_KEY) {
      const { data: owner } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("tenant_id", pm.tenant_id)
        .eq("role", "owner")
        .single();

      if (owner?.email) {
        await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: owner.email,
          subject: `New property added by ${pm.full_name}`,
          html: `
            <div style="font-family: sans-serif; color:#0f1923; max-width:560px;">
              <h2 style="margin:0 0 8px;">New Property Added</h2>
              <p style="margin:0 0 6px;">${pm.full_name} added a property via the portal link.</p>
              <p style="margin:0 0 6px;"><strong>${name}</strong></p>
              <p style="margin:0 0 6px;">${address}, ${city}, ${state} ${zip}</p>
            </div>
          `,
        }).catch((err) => console.error("[email] new property notification:", err));
      }
    }

    return jsonResponse({ property });
  } catch {
    return errorResponse("Internal server error.", 500);
  }
}
