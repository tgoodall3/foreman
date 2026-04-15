import { NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getFromAddress, renderDetailCard, renderEmailLayout, renderNoticeCard } from "@/lib/email";
import { getPortalPm } from "@/lib/portal";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const schema = z.object({
  name: z.string().min(2).max(120),
  address: z.string().min(5).max(200),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  zip: z.string().min(3).max(20),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const pm = await getPortalPm();
    if (!pm) return errorResponse("Unauthorized", 401);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return errorResponse("Invalid input.", 400);
    const { name, address, city, state, zip, notes } = parsed.data;

    const supabase = createServiceClient();

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

    if (process.env.RESEND_API_KEY) {
      const [{ data: owner }, { data: tenant }] = await Promise.all([
        supabase
          .from("profiles")
          .select("email, full_name")
          .eq("tenant_id", pm.tenant_id)
          .eq("role", "owner")
          .single(),
        supabase.from("tenants").select("name").eq("id", pm.tenant_id).single(),
      ]);

      if (owner?.email) {
        const tenantName = tenant?.name || "Foreman";
        await resend.emails.send({
          from: getFromAddress(tenantName),
          to: owner.email,
          subject: `New property added by ${pm.full_name}`,
          html: renderEmailLayout({
            tenantName,
            category: "Portal Property",
            title: "A property was added from the portal",
            greeting: `Hi ${owner.full_name || "there"},`,
            intro: `${pm.full_name} added a new property from the PM portal.`,
            previewText: `${pm.full_name} added ${name}.`,
            sections: [
              renderNoticeCard({
                tone: "success",
                eyebrow: "New property",
                title: name,
                body: `${address}, ${city}, ${state} ${zip}`,
              }),
              renderDetailCard("Property details", [
                { label: "Submitted by", value: pm.full_name },
                { label: "Street", value: address },
                { label: "City", value: city },
                { label: "State", value: state },
                { label: "ZIP", value: zip },
                { label: "Notes", value: notes || "None" },
              ]),
            ],
            footerText: "Open the owner portal if you want to review or edit the new property.",
          }),
        }).catch((err) => console.error("[email] new property notification:", err));
      }
    }

    return jsonResponse({ property });
  } catch {
    return errorResponse("Internal server error.", 500);
  }
}
