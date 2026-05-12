import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireOwner } from "@/lib/auth";
import { validateInput, updateAccountSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/api";
import { logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const profile = await requireOwner();
    if (!profile) return errorResponse("Unauthorized", 401);

    const body = await req.json();
    const validation = validateInput(updateAccountSchema, body);
    if (!validation.success) return errorResponse((validation as any).error, 400);

    const { name, phone, address, invoice_footer, tax_id, website } = validation.data;

    const supabase = createServiceClient();

    const { error } = await supabase
      .from("tenants")
      .update({
        name,
        phone: phone || null,
        address: address || null,
        invoice_footer: invoice_footer || null,
        tax_id: tax_id || null,
        website: website || null,
      })
      .eq("id", profile.tenant_id);

    if (error) return errorResponse("Failed to update account", 500);

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("Update account error", error);
    return errorResponse("Internal server error", 500);
  }
}
