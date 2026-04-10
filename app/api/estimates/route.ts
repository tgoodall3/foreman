import { NextRequest } from "next/server";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { createServerSideClient } from "@/lib/supabase-server";
import { getProfile } from "@/lib/auth";
import { createEstimateSchema, validateInput } from "@/lib/validation";
import { generateEstimateNumber } from "@/lib/utils";
import { logError } from "@/lib/logger";
import { checkPlanForApi } from "@/lib/plan";

export async function POST(req: NextRequest) {
  const profile = await getProfile();
  if (!profile) return badRequest("Unauthorized");

  const planError = await checkPlanForApi(profile);
  if (planError) return planError;

  const body = await req.json();
  const validation = validateInput(createEstimateSchema, body);
  if (!validation.success) return badRequest((validation as { error: string }).error);

  const { usePm, propertyManagerId, propertyId, clientName, clientEmail, clientPhone, title, description, lineItems, taxRate, validUntil, notes } = validation.data as any;
  const supabase = await createServerSideClient();

  // Resolve or create property manager
  let pmId = propertyManagerId as string | null;
  if (usePm) {
    const { data: pm } = await supabase
      .from("property_managers")
      .select("id")
      .eq("id", propertyManagerId)
      .eq("tenant_id", profile.tenant_id)
      .single();
    if (!pm) return badRequest("Property manager not found.");
  } else {
    // Try to re-use an existing PM by email; otherwise create a lightweight contact record
    if (!clientName) return badRequest("Client name is required.");
    let existingId: string | null = null;
    if (clientEmail) {
      const { data: existingList } = await supabase
        .from("property_managers")
        .select("id")
        .eq("tenant_id", profile.tenant_id)
        .eq("email", clientEmail)
        .limit(1);
      existingId = existingList?.[0]?.id ?? null;
    }

    if (existingId) {
      pmId = existingId;
    } else {
      const { data: inserted, error: pmInsertError } = await supabase
        .from("property_managers")
        .insert({
          tenant_id: profile.tenant_id,
          full_name: clientName,
          email: clientEmail || null,
          phone: clientPhone || null,
        })
        .select("id")
        .single();
      if (pmInsertError || !inserted) {
        logError("Failed to create client contact for estimate", pmInsertError);
        return errorResponse("Unable to save client.", 500);
      }
      pmId = inserted.id;
    }
  }

  // Get tenant slug for estimate number
  const { data: tenant } = await supabase
    .from("tenants")
    .select("slug")
    .eq("id", profile.tenant_id)
    .single();

  if (!tenant) return errorResponse("Tenant not found.", 500);

  // Count existing estimates for this tenant
  const { count } = await supabase
    .from("estimates")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id);

  const sanitizedLineItems = lineItems.map((item) => {
    const quantity   = Number(item.quantity);
    const unit_price = Number(item.unit_price);
    const total      = Math.round((quantity * unit_price + Number.EPSILON) * 100) / 100;
    return { description: item.description.trim(), quantity, unit_price, total };
  });

  const subtotal   = sanitizedLineItems.reduce((sum, i) => sum + i.total, 0);
  const taxRateVal = taxRate ?? 0;
  const taxAmount  = Math.round((subtotal * taxRateVal / 100 + Number.EPSILON) * 100) / 100;
  const total      = Math.round((subtotal + taxAmount + Number.EPSILON) * 100) / 100;

  const estimateNumber = generateEstimateNumber(tenant.slug, (count ?? 0) + 1);

  const { data: estimate, error: insertError } = await supabase
    .from("estimates")
    .insert({
      tenant_id:           profile.tenant_id,
      property_manager_id: pmId,
      property_id:         propertyId ?? null,
      estimate_number:     estimateNumber,
      status:              "draft",
      title:               title.trim(),
      description:         description?.trim() || null,
      line_items:          sanitizedLineItems,
      subtotal,
      tax_rate:            taxRateVal,
      tax_amount:          taxAmount,
      total,
      valid_until:         validUntil ?? null,
      notes:               notes?.trim() || null,
    })
    .select("id")
    .single();

  if (insertError || !estimate) {
    logError("Estimate create failed", insertError);
    return errorResponse("Failed to create estimate.", 500);
  }

  return jsonResponse({ success: true, estimateId: estimate.id }, 201);
}
