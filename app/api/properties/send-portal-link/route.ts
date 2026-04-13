import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireOwner } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";
import { errorResponse } from "@/lib/api";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req: NextRequest) {
  try {
    const owner = await requireOwner();
    if (!owner) return errorResponse("Unauthorized", 401);

    const { propertyManagerId } = await req.json();
    if (!propertyManagerId) return errorResponse("propertyManagerId is required", 400);

    const supabase = createServiceClient();
    const { data: pm } = await supabase
      .from("property_managers")
      .select("id, tenant_id, full_name, email, portal_token")
      .eq("id", propertyManagerId)
      .single();

    if (!pm || pm.tenant_id !== owner.tenant_id) return errorResponse("Not found", 404);
    if (!pm.email) return errorResponse("PM missing email", 400);
    if (!pm.portal_token) return errorResponse("PM missing portal token", 400);

    const portalLink = `${process.env.NEXT_PUBLIC_APP_URL}/portal?token=${pm.portal_token}`;

    if (resend && process.env.EMAIL_FROM) {
      await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: pm.email,
        subject: "Your contractor invited you to Foreman portal",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; color: #0f1923;">
            <div style="background: #0f1923; padding: 18px 20px; border-radius: 10px 10px 0 0;">
              <span style="font-size: 20px; font-weight: 800; color: #f59e0b; letter-spacing: 1px;">FOREMAN</span>
              <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0;">Access your portal to submit work orders and track jobs.</p>
            </div>
            <div style="background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="margin: 0 0 10px; font-weight: 700; font-size: 16px;">Hi ${pm.full_name},</p>
              <p style="margin: 0 0 12px; color: #6b7280; font-size: 14px;">Use the link below to open your portal and manage properties and work orders.</p>
              <a href="${portalLink}" style="display:inline-block; background:#f59e0b; color:#0f1923; padding:12px 16px; border-radius:10px; font-weight:700; text-decoration:none;">Open Portal</a>
            </div>
          </div>
        `,
      }).catch((err) => console.error("[email] portal link:", err));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("send-portal-link error", error);
    return errorResponse("Internal server error", 500);
  }
}
